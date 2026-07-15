# Draw by Threefold Repetition (Pebble Trap)

Adds a draw outcome to the well game (and the engine generally) when the same board position recurs three times. Extends the shipped `pebble-trap` game (all 5 phases complete). Normative spec, written so a smaller model can implement without guessing.

## Problem Statement

In the well game, some games never terminate: two careful players can settle into a mutual cycle that shuffles pebbles through the center `C` indefinitely with no trap ever available. There is currently no draw — the only terminal state is a trap-win. Cost of not solving: games between non-blundering players never finish; the win-path is only reachable by cooperation or a mistake.

Note on mechanism (corrected after adversarial review): a single player *camping* on `C` does NOT cause the loop — with `C` fixed, the empty vertex is confined to the outer path `E–N–W–S`, which is a tree (acyclic), so such play always terminates. Non-termination requires a **mutual cycle in which `C` itself is repeatedly passed back and forth**. The shortest such cycle is 6 plies (proven by exhaustive search of the 60-position movement graph). This is what threefold repetition catches.

## Evidence

- Main PRD, Trap Math: "Both trap patterns require the winner to hold `C`; a player occupying `C` can never be trapped. Consequence: perfect play can cycle forever — accepted for v1 (no draw rule, manual restart)."
- Main PRD deferred this exact feature: Decisions Log / MoSCoW list "Threefold-repetition draw — Could / deferred by user decision."
- Math (verified): movement-phase positions = 2 red + 2 blue + 1 empty over 5 vertices = 5!/(2!·2!·1!) = 30 layouts × 2 sides-to-move = **60 distinct positions**. A game that never ends must, by pigeonhole, revisit a position — so threefold repetition is guaranteed to terminate every otherwise-infinite game (within ~120 movement plies at the absolute most).

## Proposed Solution

Record every movement-phase position (board layout + side-to-move) in engine state. When any position reaches its 3rd occurrence, `applyMove` ends the game as a draw (`phase:'gameover'`, `winner:null`). This is a pure-engine rule addition, gated by a new optional `EngineConfig.repetitionLimit` so it is opt-in per mode (well sets it to 3; modes that omit it never draw — backward compatible). Chosen over "same single move 3×" because a whole-board key catches every cycle length, not just simple back-and-forth shuffles.

## Key Hypothesis

We believe threefold-position-repetition draw detection will make otherwise-infinite well games terminate for two careful players.
We'll know we're right when the scripted 6-ply C-oscillating cycle (see T8) ends in an auto-declared draw on the 3rd occurrence of a repeated position, and the existing 17 engine tests plus all win/trap paths still pass unchanged.

## What We're NOT Building

- Claimable/offered draws (a "claim draw" button) — auto-declare only (user decision); simplest for hotseat.
- Fifty-move-style or move-count draws — repetition only.
- Draw by agreement, stalemate variants, or resignation — out of scope.
- Persisting history across games — restart clears it (fresh `initialState`).
- Any change to modes 2/3 (they don't exist yet); the seam is opt-in so they choose.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Draw detection | scripted 3-fold shuffle → `phase:'gameover'`, `winner:null` | new vitest vector (T8) |
| Win beats draw | a trapping move on/near a repeat still wins, never draws | vitest (T9) |
| No false draw | distinct positions never trigger a draw | vitest (T10) |
| No regression | existing 17 engine tests unchanged, green | `vitest` |
| Visible outcome | HUD shows "Draw!" (neutral), not a winner | in-browser: play a shuffle to a draw |

## Open Questions

- [ ] Should the HUD name the reason ("Draw — repetition") or just "Draw!"? Default: just "Draw!" (minimal), reason is a Could.
- [ ] Cosmetic: a subtle move-counter or "repetition 2/3" hint to warn players before the draw? Deferred (Could).

---

## Users & Context

**Primary User**
- **Who**: Two people playing hotseat on one phone (same as main PRD).
- **Current behavior**: a careful player parks on `C` and the game never ends; they give up and restart manually.
- **Trigger**: a game settles into a repeating shuffle with no trap available.
- **Success state**: the game ends itself with a clear "Draw!" and offers Play again / Menu.

**Job to Be Done**
When a game has clearly settled into a repeating cycle with no winner possible, I want it to end in a draw automatically, so we can start a fresh game without arguing about when to stop.

**Non-Users**
Competitive/ranked players wanting claimable draws or draw-offer etiquette — not this v1.

---

## Solution Detail

### Rules (NORMATIVE — implement exactly)

#### Position key
A position is `(board layout, side-to-move)`. Serialize deterministically using the mode's fixed vertex order:

```
key = cfg.board.vertices.map(v => s.board[v.id] ?? '.').join('') + '|' + s.current
// e.g. well board, red C+N, blue S+W, empty E, red to move -> "1.221|1"
//   (order C,N,E,S,W from WELL_MODE.vertices; '.' = empty, 1/2 = player)
```
Only **movement-phase** positions are recorded. Placement positions strictly gain pebbles (monotonic) and can never recur, so they are never keyed.

#### History in state
`GameState` gains an OPTIONAL field `history?: Record<string, number>` (position key → occurrence count). Optional so existing partial-state test fixtures keep compiling; treat `undefined` as `{}`.

- `initialState` sets `history: {}`.
- `applyMove` records the resulting position when it is a movement-phase state (including the placement→movement transition state, which is occurrence 1 for that position).

#### EngineConfig gate
`EngineConfig` gains OPTIONAL `repetitionLimit?: number`. When set (well = 3), a draw fires the moment a position's recorded count reaches it. When `undefined`, repetition is never checked (backward-compatible; modes opt in).

#### Draw outcome
Reuse the existing terminal shape — no new `Phase` value:
- **Win**: `phase:'gameover'`, `winner` = the player who just moved.
- **Draw**: `phase:'gameover'`, `winner: null`.
- Invariant (document loudly): `phase === 'gameover' && winner === null` ⇔ **draw**. During play `phase` is `placement`/`movement` with `winner:null`, so there is no ambiguity. `legalMoves` of any gameover state is `[]` (already true).

#### applyMove ordering (CRITICAL)
After advancing the move and recording history into `next`:
1. **Win check FIRST**: if `next.phase === 'movement'` and `legalMoves(cfg, next).length === 0` → trap-win (`winner` = mover).
2. **Draw check SECOND**: else if `cfg.repetitionLimit` is set, `next.phase === 'movement'`, and the recorded count for `next`'s position `>= repetitionLimit` → draw (`winner: null`).
3. Else return `next`.

Invariant (win and draw are disjoint, so the order is safe but not arbitrating a real tie): a trapping move produces a terminal state, and a terminal state is reached at most once per game (the game ends there), so its recorded count is always ≤ 1 < `repetitionLimit`. No single move can be both a win and a 3rd repetition. Win-check-first is kept for clarity, not because a conflict exists.

#### Restart
`initialState` (called by `restartGame`) yields empty `history` — repetition never carries across games.

### Engine signatures (unchanged externally)
`initialState(cfg, modeId)`, `legalMoves(cfg, s)`, `applyMove(cfg, s, m)` keep the same signatures. Only their internals and the `GameState`/`EngineConfig` shapes gain the optional fields above.

### Test Vectors (must be in the vitest suite)

- **T8 draw on threefold** (CONCRETE — a back-and-forth "out and back" is provably impossible with one empty vertex; the real minimal cycle is 6 plies through `C`). Start from a movement state `board {C:null, N:1, E:1, S:2, W:2}`, red (1) to move, `history` seeded so the START position counts as occurrence 1 (i.e. `{ [keyOf(start)]: 1 }`). Apply this 6-ply cycle (it returns to START), then the same 6 plies again:
  ```
  1 red  N→C    2 blue W→N    3 red  C→W    4 blue N→C    5 red  W→N    6 blue C→W   (START, 2nd occurrence)
  7 red  N→C    8 blue W→N    9 red  C→W   10 blue N→C   11 red  W→N   12 blue C→W   (START, 3rd → DRAW)
  ```
  Assert the ply-12 result is `phase:'gameover'`, `winner:null`. (No trap ever fires — every node of a cycle has a legal continuation. If you instead start from empty `history:{}`, the draw fires one ply later on a different cycle position reaching its 3rd; either is acceptable — pick the seeded form for a clean assertion.)
- **T9 given-a-choice, win is taken**: a win and a draw can NEVER be the same move — a trapping move produces a terminal state, which occurs at most once per game, so its count is always ≤ 1 < limit (the two conditions are provably disjoint). T9 therefore just confirms the ordering doesn't misfire: from a state where one legal move traps the opponent, applying that move yields `winner` = mover (not a draw), regardless of any unrelated repetition counts in `history`.
- **T10 no false draw**: a sequence of all-distinct positions (each move reaches a new layout) never draws while every count stays < limit.
- **T11 backward compat**: pass a config with repetition OFF — `applyMove({ ...WELL_MODE.engine, repetitionLimit: undefined }, ...)` — through the T8 12-ply sequence and assert it NEVER draws (stays `movement`). Note: you MUST spread a fresh config here; you cannot reuse `WELL_MODE.engine` because it now carries `repetitionLimit: 3`.
- **T12 history immutability**: `applyMove` does not mutate the input state's `history` (snapshot/`structuredClone` compare).
- **Regression**: the existing T1–T7 stay green. WELL_MODE gains `repetitionLimit: 3`; verify T4/T7 (fast win/trap) still end as wins — traced: longest existing chain is ≤5 plies, none repeats, so none reaches count 3.

Fixture notes:
- The `makeState` helper gains a `history: {}` default (tests override it, e.g. T8's seeded start).
- `applyMove` MUST read `s.history ?? {}` — `history` is optional and `strict` mode makes an unguarded `s.history[key]` a compile error (caught by typecheck, but specify it so the implementer writes the guard).
- Add a helper `keyOf(cfg, state)` in the test file mirroring the engine's serialization, so T8 can seed/inspect counts.

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Record movement positions in `GameState.history` | detection substrate |
| Must | Threefold auto-draw in `applyMove`, gated by `repetitionLimit` | the feature |
| Must | Win-before-draw ordering | correctness (trap must still win) |
| Must | HUD shows "Draw!" for gameover+winner:null | user sees the outcome |
| Must | T8–T12 + regression green | the spec, encoded |
| Should | Neutral draw styling (not red/blue) | reads as "no winner" |
| Could | HUD "reason: repetition" text | nice-to-have |
| Could | Pre-draw hint ("2/3 repetition") | anti-surprise |
| Won't | Claimable draws, agreement, move-count draws | scope cut |

### MVP Scope
Phase 1 (engine + tests) validates the hypothesis headlessly. Phase 2 (HUD) makes it visible.

### User Flow
Game settles into a mutual `C`-passing cycle → a position occurs a 3rd time → `applyMove` returns gameover with `winner:null` → HUD replaces the turn line with a neutral **"Draw!"** overlay + [Play again] [Menu] (same overlay shell as a win). Board taps are already blocked at gameover.

---

## Technical Approach

**Feasibility**: HIGH — small, additive, pure-engine change plus one HUD branch. No new scene code, no new files beyond tests.

**Architecture Notes**
- Draw logic lives entirely in `engine/rules.ts` + the `GameState`/`EngineConfig` types — matches the main PRD's "engine is the single source of truth."
- `BoardScene` needs NO change: it threads state through `applyMove`/`legalMoves` generically and already guards input on `phase === 'gameover'`. This is the multi-mode architecture paying off — a rule change touches the engine, not the renderer.
- `repetitionLimit` is exactly the "optional rule-hook seam on `EngineConfig`" the main PRD's Key Hypothesis reserved for rule-shape changes. This is the first (planned) use of it.
- HUD (NORMATIVE, guard required): `winner` is `null` for the entire game except a trap-win, so the draw branch MUST check phase too. Define `isOver = phase === 'gameover'`; render exactly one overlay when `isOver`: `winner !== null` → "{name} wins!", else → "Draw!". Concretely refactor the current `Hud.tsx` win block (`isOver && game.winner !== null && …`) into a single `isOver && (game.winner !== null ? <Win/> : <Draw/>)` so a gameover with `winner:null` can never render a blank HUD (no overlay, no turn line). A bare `winner === null` check without `isOver` would show "Draw!" from the first placement — do not write that.

**Files (expected)**
- `src/game/engine/types.ts` — `history?` on `GameState`, `repetitionLimit?` on `EngineConfig`.
- `src/game/engine/rules.ts` — key/record/draw logic + win-before-draw ordering.
- `src/game/modes/well/index.ts` — `engine.repetitionLimit: 3`.
- `src/game/engine/__tests__/rules.test.ts` — T8–T12 + `makeState` history default.
- `src/ui/Hud.tsx` — draw branch in the overlay.
- `public/style.css` — optional neutral draw color.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Draw fires before a win (ordering) | M | win-check strictly before draw-check; T9 guards it |
| Existing fixtures break on new state field | M | `history` OPTIONAL + `makeState` default; run all 17 first |
| Non-deterministic key (object order) | L | serialize via `cfg.board.vertices` fixed order, not `Object.keys(board)` |
| Placement positions falsely keyed | L | only record when `next.phase === 'movement'` |
| Draw ambiguous with "still playing" | L | invariant: gameover+winner:null = draw; documented + asserted in tests |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Engine draw detection | history + repetitionLimit + threefold draw in rules.ts, well config, T8–T12 + regression | complete | - | - | [plan](../plans/completed/draw-by-repetition-phase-1-engine.plan.md) · [report](../reports/draw-by-repetition-phase-1-engine-report.md) |
| 2 | HUD draw display | "Draw!" overlay branch + neutral styling, browser validation of a scripted draw | pending | - | 1 | - |

### Phase Details

**Phase 1: Engine draw detection**
- **Goal**: correct, tested threefold draw, zero rendering.
- **Scope**: `types.ts` (optional fields), `rules.ts` (key/record/order), `modes/well` (`repetitionLimit: 3`), tests T8–T12, `makeState` default, regression green.
- **Success signal**: `vitest` green including new vectors; existing 17 unchanged; no phaser import under `engine/`.

**Phase 2: HUD draw display**
- **Goal**: player sees the draw.
- **Scope**: `Hud.tsx` draw branch (gameover + winner null → "Draw!"), neutral color, [Play again][Menu] reused. Browser: script a shuffle to a draw, confirm overlay.
- **Success signal**: in-browser scripted repetition ends with "Draw!" overlay, zero console errors; restart clears it.

### Parallelism Notes
Sequential — phase 2 shows what phase 1 computes. Phase 1 is independently valuable (headless-correct).

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Repeat unit | full board position + side-to-move | same single move 3× | catches every cycle length; single-move misses 4-loops (user chose) |
| Trigger | auto-declare | claimable button | simplest for hotseat (user chose) |
| Threshold | 3 total occurrences | 4 total | matches chess threefold; "repeat 3 times" reads as this (user chose) |
| Draw representation | `phase:'gameover'`, `winner:null` | new `Phase:'draw'` | no Phase-union change → BoardScene/HUD switches untouched; unambiguous invariant |
| Gate | optional `EngineConfig.repetitionLimit` | always-on in engine | opt-in per mode; backward-compatible; uses the reserved rule-hook seam |
| History storage | `Record<key, count>` optional on state | external/global | pure + immutable; optional keeps fixtures compiling |

---

## Research Summary

**Market Context**
Threefold repetition is the standard draw mechanism in chess and many abstract strategy games; whole-position keying (not move keying) is the established correct approach. The well game's tiny state space (60 movement positions) makes it a textbook case where repetition detection guarantees termination.

**Technical Context**
Engine is pure TS with `initialState`/`legalMoves`/`applyMove` and an immutable `GameState` (see completed `pebble-trap.prd.md` and `engine/rules.ts`). `applyMove` already runs a post-move terminal check (trap); the draw check slots in right after it. `EngineConfig` already carries `pebblesPerPlayer`; `repetitionLimit` joins it. HUD already renders a gameover overlay keyed on `winner`.

---

*Generated: 2026-07-15*
*Status: REVIEWED — adversarially refuted by an Opus agent 2026-07-15 (exhaustive 60-node graph search). 5 findings applied: CRITICAL T8 was unconstructible ("out-and-back"/"C-camping" both impossible) → replaced with the real 6-ply C-oscillating cycle; win/draw proven disjoint (T9 reworded); HUD draw branch made phase-guarded/single-overlay; T11 must spread a fresh config; problem mechanism corrected. Survived: 60-position math, gameover+null uniqueness, key serialization. Relates to completed pebble-trap.prd.md.*
