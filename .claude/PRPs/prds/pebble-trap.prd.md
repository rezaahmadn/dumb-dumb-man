# Pebble Trap (working title) — Mode 1: "Well Board"

Mobile-first 2-player trap board game. Phaser 4 + React + TypeScript. Multi-mode architecture; this PRD covers Mode 1 only.

Spec style: terse, normative. Every rule is exact. Written to be implemented by a smaller AI model without guessing.

## Problem Statement

Reza wants a small, well-built mobile board game with 3 planned modes. No codebase exists. Risk to solve for: game logic tangled with rendering makes mode 2/3 and asset swaps painful. Cost of not solving: rewrite per mode.

## Evidence

- Mode 1 rules are a placement variant of umul gonu (우물고누, Korean "well game") — centuries-old, proven playable.
- Math (verified below): the board MUST have one missing arc, or no trap is ever possible and the game cannot be won.
- Official template exists: `phaserjs/template-react-ts` (Phaser 4.0.0 + React 19 + TS 5.7 + Vite 6 + EventBus bridge — versions verified 2026-07-14).

## Proposed Solution

One repo, three layers, hard boundaries:

1. **Engine** — pure TypeScript game rules. Zero Phaser/React imports. Unit-tested.
2. **Renderer** — one generic Phaser `BoardScene` that draws any `BoardDef` + `GameState`.
3. **Shell** — React for menu/mode-select/HUD chrome, talks to Phaser via the template's EventBus.

A game mode = one folder (board data + mode def) + one registry entry. Adding mode 2 must not modify engine core or `BoardScene`.

## Key Hypothesis

We believe a pure-engine + generic-renderer + mode-registry split will make modes cheap to add.
We'll know we're right when Mode 2 ships as a new mode folder + registry entry. Board-topology-only modes (same place/move/trap rule shape) require ZERO edits to `engine/rules.ts` and `BoardScene.ts`. If Mode 2 changes the rule shape, the one permitted engine change is adding the optional rule-hook seam to `EngineConfig` — a single planned edit, not a rewrite.

## What We're NOT Building (v1)

- Online multiplayer — hotseat only (user decision).
- AI opponent — deferred; game tree is tiny (~5 vertices), a perfect solver is easy later.
- Modes 2 and 3 — architecture must be ready, features are not.
- Draw/repetition detection — user chose none for v1; players restart manually.
- Accounts, persistence, sound — later.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Engine rule tests | 100% pass, includes test vectors T1–T7 below | `vitest` |
| Full game playable | place → move → trap → win banner → restart, no errors | replay T7 placement sequence + T4 position on device (free play can cycle forever — see Trap Math) |
| Portrait lock | desktop browser shows centered 9:16 pillar, never full-width | resize window, inspect |
| Performance | 60fps on mid-range phone, load < 3s | Chrome DevTools |

## Open Questions

- [ ] Real game/app name (working title "Pebble Trap").
- [ ] Mode 2 and Mode 3 rules (Reza has ideas; capture in their own PRD phases later).
- [ ] Visual theme: v1 is procedural graphics (circles/lines); sprite assets later via manifest.
- [ ] Rematch variant: should the LOSER start the next game? (v1 decided: P1 red always starts — see Decisions Log.)

---

## Users & Context

**Primary User**
- **Who**: Two people sharing one phone (pass-and-play). Secondary: desktop browser.
- **Current behavior**: play quick casual games in short sessions.
- **Trigger**: idle minutes together.
- **Success state**: complete a game in 1–3 minutes, immediately understand who won and why.

**Job to Be Done**
When we have a few idle minutes together, I want to play a quick tactical game on one phone, so I can have fun without setup or accounts.

**Non-Users**
Online/ranked players. Solo players (until AI mode ships).

---

## Solution Detail

### Game Rules (NORMATIVE — implement exactly this)

#### Board: "Well Board"

5 vertices. A circle with a vertical and a horizontal diameter, with the **bottom-right arc (S–E) missing**. This gap is a real board feature, confirmed by user, and required: see Trap Math.

```
        N
     .--+--.
    /   |   \
   W----C----E
    \   |
     '--+    <-- S-E arc absent ("the well")
        S
```

Vertex ids: `C` (center), `N`, `E`, `S`, `W`.

Edges (7 total): `N-C`, `C-S`, `W-C`, `C-E`, `E-N`, `N-W`, `W-S`. There is NO `S-E` edge.

**Lines** (normative movement data — maximal straight/continuous paths; edges are derived from consecutive pairs):

```ts
lines: [
  ['N','C','S'],      // vertical diameter
  ['W','C','E'],      // horizontal diameter
  ['E','N','W','S'],  // rim arc path (stops at the gap)
]
```

Design-space vertex coordinates (720×1280 portrait, board center (360, 560), radius 270):

```ts
vertices: [
  { id: 'C', x: 360, y: 560 },
  { id: 'N', x: 360, y: 290 },
  { id: 'E', x: 630, y: 560 },
  { id: 'S', x: 360, y: 830 },
  { id: 'W', x:  90, y: 560 },
]
```

#### Players

- Player 1 = red pebbles. Player 2 = blue pebbles. 2 pebbles each.
- Player 1 always moves first (v1).
- Turns strictly alternate. No passing, ever. If a move is available, the player must move.

#### Phase 1: Placement

1. Board starts empty.
2. Turn order: P1, P2, P1, P2 — one pebble per turn, until each player has placed 2.
3. A pebble may be placed on ANY empty vertex, including `C`.
4. Placement is never blocked (an empty vertex always exists).
5. Placement ends after `2 × pebblesPerPlayer` total placements (Mode 1: 4). Phase becomes `movement`, current player becomes P1, and the trap check (below) runs immediately — if the placement phase left P1 with no legal move, P1 loses on the spot (see T7).

#### Phase 2: Movement

1. On your turn, move exactly one of your own pebbles along one **line**.
2. A pebble at index `i` of a line may move to index `j` of the same line (`j ≠ i`, either direction) iff **every vertex strictly between `i` and `j`, and vertex `j` itself, are empty**.
3. No jumping over ANY pebble — own or opponent's. A pebble may stop at ANY empty vertex strictly before the first occupied vertex in its direction of travel. Stopping early is always allowed — slides are NEVER forced to maximum distance.
4. Multi-step slides are legal in the engine (rule 2 allows any distance). NOTE: in Mode 1 after placement only 1 vertex is ever empty, so every reachable move is in practice a single step into the empty vertex. Implement the general slide rule anyway — future modes need it.
5. A destination reachable via two different lines is ONE move — deduplicate legal moves by `(from, to)`.

#### Win Condition (Trap)

After every applied move (placement or movement): if phase is `movement` and the player now to move has zero legal moves, that player **loses immediately**. The player who just moved wins. No draws in v1.

On gameover the state is: `phase:'gameover'`, `winner` = the player who just moved, `current` = the trapped player. Display logic reads `winner`, never `current`.

#### Trap Math (invariants — encode as tests, and reviewers must verify)

- Full circle (8 edges) would make trapping impossible → game unwinnable. Hence the S–E gap.
- With the gap, adjacency is: `C:{N,E,S,W}`, `N:{C,E,W}`, `E:{C,N}`, `S:{C,W}`, `W:{C,N,S}`.
- After placement exactly 1 vertex is empty. The mover has a legal move iff one of their pebbles is adjacent to the empty vertex.
- Therefore only two trap patterns exist in Mode 1:
  - empty `E`, loser's pebbles on `S`+`W` (winner holds `C`+`N`)
  - empty `S`, loser's pebbles on `N`+`E` (winner holds `C`+`W`)
- Empty `C`, `N`, or `W` → the mover always has a move (never a trap).
- Both trap patterns require the winner to hold `C`; a player occupying `C` can never be trapped. Consequence: perfect play can cycle forever — accepted for v1 (no draw rule, manual restart). Win-path verification therefore uses scripted sequences (T4, T7), not free play.

#### Engine Test Vectors (must all be in the vitest suite)

- **T1 board sanity**: 5 vertices; deriving edges from `lines` yields exactly the 7 edges listed; `S-E` is not an edge.
- **T2 placement**: initial state → P1 has exactly 5 legal moves, all `place`.
- **T3 trap detect**: `{phase:'movement', board:{C:1,N:1,E:null,S:2,W:2}, current:2}` → `legalMoves` is `[]`.
- **T4 win on move**: `{phase:'movement', board:{E:1,N:1,S:2,W:2,C:null}, current:1}`, apply `{kind:'move', from:'E', to:'C'}` → resulting state has `phase:'gameover'`, `winner:1`.
- **T5 slide + dedupe** (engine-general, unreachable in mode-1 play): lone red pebble at `S`, all else empty, red to move → destination set is exactly `{C, N, W, E}` (`C`,`N` via vertical; `W`,`N`,`E` via rim; `N` deduped).
- **T6 blocking** (engine-general, unreachable in mode-1 play): red at `S`, blue at `C` and `W`, red to move → red has zero moves (vertical blocked at `C`, rim blocked at `W`).
- **T7 trap on final placement**: from initial state apply places `S`(P1), `C`(P2), `W`(P1), `N`(P2) → resulting state has `phase:'gameover'`, `winner:2` (empty `E`; P1's pebbles `S`+`W` are not adjacent to `E`). Guards the placement→movement transition trap check — an implementation that only checks traps after movement moves passes T1–T6 but soft-locks here.

Fixture note: vectors list only decision-relevant fields. Tests build full `GameState` via a helper with defaults (`modeId:'well'`, `placed:{1:2,2:2}`, `winner:null`), overridden per vector.

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Portrait resolution lock (desktop = centered pillar) | explicit user requirement |
| Must | Mode 1 full rules: placement, sliding movement, trap win | the game itself |
| Must | Hotseat turn flow + win banner + restart | minimum playable loop |
| Must | Pure engine + vitest suite (T1–T7 minimum) | correctness + refactor safety |
| Must | Mode registry + generic BoardScene | user's maintainability requirement |
| Should | Legal-move highlights on pebble select | usability on touch |
| Should | Move tween animation (~200ms) | readability of turns |
| Should | Mode select screen (lists 1 mode) | proves the multi-mode shell |
| Could | Asset manifest with sprite override of procedural graphics | user wants asset swaps later |
| Could | Threefold-repetition draw | deferred by user decision |
| Won't | Online play, AI, modes 2–3, sound, persistence | v1 scope cut |

### MVP Scope

Phases 1–4 below. Menu polish (phase 5) can trail.

### User Flow

Launch → menu (mode list: "Well Board") → tap mode → empty board, "Red: place pebble (1/2)" → 4 placements alternating → "Red: move a pebble" → tap own pebble (highlights + legal destinations) → tap destination (tween) → turns alternate → trap occurs → "Red wins!" overlay → [Play again] [Menu].

Input rules: placement = tap empty vertex (tap elsewhere ignored). Movement = tap own pebble to select/reselect, tap legal destination to move, tap anything else to deselect. All tap targets ≥ 48px hit radius in design space.

---

## Technical Approach

**Feasibility**: HIGH — official template, no backend, no assets pipeline required for v1.

**Stack**: `phaserjs/template-react-ts` (Phaser 4.0.0, React 19, TypeScript 5.7, Vite 6, EventBus). Add `vitest` for engine tests. Phaser 4 keeps the v3 API surface for Scale/Scene/Graphics/Tweens/Input; documented fallback if a v4 regression blocks phase 3: pin `phaser@^3.90`.

**Portrait lock** (normative):

```ts
// design resolution 720×1280 (9:16)
scale: {
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: 720,
  height: 1280,
}
```

`FIT` preserves aspect ratio in both directions: a wide (16:9) desktop window renders a centered 9:16 pillar with letterbox left/right; a window narrower than 9:16 fits the width with letterbox top/bottom. The canvas never exceeds a 9:16 pillar — never full desktop width. Wrap canvas in a full-viewport flex container; letterbox/page background = dark neutral from `theme.ts` (default `#111418`).

**Board rendering** (procedural v1, no image assets): Phaser `Graphics`, driven ONLY by `GameModeDef.boardStrokes` + vertex coordinates. Arc stroke maps to:

```ts
g.arc(cx, cy, radius, Phaser.Math.DegToRad(startDeg), Phaser.Math.DegToRad(endDeg), false);
// Phaser takes RADIANS — always convert. Passing 90/360 raw draws garbage.
```

The well-board arc (90°→360° clockwise, screen coords y-down) passes S→W→N→E and leaves the S–E quadrant open, matching the drawing. Pebbles = filled circles (red `#E53935`, blue `#1E88E5`) until sprite assets arrive.

**Architecture / file layout** (normative):

```
src/
  main.tsx, App.tsx          # React shell: menu <-> game
  ui/                        # React: MainMenu, HUD pieces
  game/
    EventBus.ts, PhaserGame.tsx   # from template
    engine/                  # PURE TS — importing phaser here is a review-blocker
      types.ts               # VertexId, PlayerId, Phase, GameState, Move, BoardDef
      board.ts               # edges/adjacency derived from lines
      rules.ts               # initialState, legalMoves, applyMove (pure functions)
      __tests__/rules.test.ts
    modes/
      types.ts               # GameModeDef { id, name, engine: EngineConfig, boardStrokes }
      registry.ts            # MODES: Record<string, GameModeDef>
      well/index.ts          # Mode 1 def (board + strokes data above)
    scenes/
      BootScene.ts, BoardScene.ts   # BoardScene is generic over GameModeDef
    render/
      theme.ts               # colors, radii, tween durations
      assets.ts              # manifest stub: key→path, procedural fallback
```

**Core engine types + signatures** (normative):

```ts
// engine/types.ts — engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/)
type VertexId = string;                 // 'C' | 'N' | 'E' | 'S' | 'W' in mode 1
type PlayerId = 1 | 2;
type Phase = 'placement' | 'movement' | 'gameover';

interface BoardDef { vertices: {id: VertexId; x: number; y: number}[]; lines: VertexId[][]; }
interface EngineConfig { board: BoardDef; pebblesPerPlayer: number; }   // Mode 1: pebblesPerPlayer = 2

interface GameState {
  modeId: string;
  phase: Phase;
  board: Record<VertexId, PlayerId | null>;
  current: PlayerId;
  placed: Record<PlayerId, number>;
  winner: PlayerId | null;
}

type Move = { kind: 'place'; to: VertexId } | { kind: 'move'; from: VertexId; to: VertexId };

// engine/rules.ts — config is always PASSED IN; engine never resolves modeId via any registry
function initialState(cfg: EngineConfig, modeId: string): GameState;
function legalMoves(cfg: EngineConfig, s: GameState): Move[];
function applyMove(cfg: EngineConfig, s: GameState, m: Move): GameState;
```

`applyMove` returns a NEW state (no mutation), advances `current`, transitions placement→movement after `2 × cfg.pebblesPerPlayer` placements (never hardcode 4), and runs the trap check. `legalMoves` of a `gameover` state is `[]`. Illegal move → throw.

**Mode definition + render data** (normative — this is what keeps `BoardScene` generic):

```ts
// modes/types.ts — modes depend on engine types; never the reverse
type Stroke =
  | { kind: 'segment'; from: VertexId; to: VertexId }
  | { kind: 'arc'; cx: number; cy: number; radius: number; startDeg: number; endDeg: number };
    // arc: clockwise, screen coords (y down): 0°=E, 90°=S, 180°=W, 270°=N

interface GameModeDef {
  id: string;                    // 'well'
  name: string;                  // 'Well Board'
  engine: EngineConfig;
  boardStrokes: Stroke[];        // BoardScene draws ONLY these + vertex dots — zero board-specific scene code
}

// modes/well/index.ts
boardStrokes: [
  { kind: 'segment', from: 'N', to: 'S' },
  { kind: 'segment', from: 'W', to: 'E' },
  { kind: 'arc', cx: 360, cy: 560, radius: 270, startDeg: 90, endDeg: 360 }, // S→W→N→E; leaves S–E gap
]
```

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rules bugs (slide/trap edge cases) | M | pure engine + test vectors T1–T7 before any rendering |
| Phaser/React state drift | M | engine state is the single source of truth; scene renders from state; EventBus events carry state snapshots |
| Mode 2/3 needing different rule shapes | M | `GameModeDef` is the extension seam; add optional rule hooks then, not now |
| Touch targets too small on phones | L | 48px+ design-space hit radius, FIT scaling keeps proportions |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Scaffold | template-react-ts, strip demo, portrait lock, folder skeleton, vitest wired | complete | - | - | [plan](../plans/completed/phase-1-scaffold.plan.md) · [report](../reports/phase-1-scaffold-report.md) |
| 2 | Engine | types/board/rules pure TS + full test suite (T1–T7+) | complete | with 3 | 1 | [plan](../plans/completed/phase-2-engine.plan.md) · [report](../reports/phase-2-engine-report.md) |
| 3 | Board render | BoardScene draws well board statically from BoardDef | complete | with 2 | 1 | [plan](../plans/completed/phase-3-board-render.plan.md) · [report](../reports/phase-3-board-render-report.md) |
| 4 | Interaction & flow | taps, selection highlights, tweens, HUD, trap/win overlay, restart | complete | - | 2, 3 | [plan](../plans/completed/phase-4-interaction-flow.plan.md) · [report](../reports/phase-4-interaction-flow-report.md) |
| 5 | Shell & polish | mode-select menu via registry, asset manifest stub, theme pass | pending | - | 4 | - |

### Phase Details

**Phase 1: Scaffold**
- **Goal**: running portrait-locked empty game.
- **Scope**: clone template, remove demo scene/assets, apply scale config, create folder layout, `npm run test` works.
- **Success signal**: dev server shows empty 720×1280 canvas; desktop window resize keeps centered pillar.

**Phase 2: Engine**
- **Goal**: complete correct rules, zero rendering.
- **Scope**: `types.ts`, `board.ts`, `rules.ts`, tests incl. T1–T7.
- **Success signal**: `vitest` green; no phaser import anywhere under `engine/`.

**Phase 3: Board render**
- **Goal**: board looks like the drawing.
- **Scope**: BoardScene static render (arc with gap, diameters, vertex dots) from `WELL_BOARD` data only.
- **Success signal**: visual match; changing a stroke or vertex coordinate in mode data changes the rendering (scene contains no well-specific constants).

**Phase 4: Interaction & flow**
- **Goal**: fully playable hotseat game.
- **Scope**: placement taps, select/highlight/move, engine drives everything, turn HUD, win overlay, restart.
- **Success signal**: complete game ending in a trap; T3/T4 positions reproducible by hand on device.

**Phase 5: Shell & polish**
- **Goal**: multi-mode shell proven.
- **Scope**: React menu listing `MODES` registry, back-to-menu, theme constants, asset manifest stub.
- **Success signal**: menu → game → win → menu loop; adding a fake second registry entry shows two menu items with zero scene edits.

### Parallelism Notes

Phases 2 and 3 share only phase 1's skeleton: engine is pure TS, static render needs only `BoardDef` data. Safe to run concurrently. Phase 4 is the join point.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Board topology | S–E arc missing (7 edges) | full circle | user confirmed drawing gap; full circle = trap impossible (proved) |
| Placement | any empty vertex incl. center | center forbidden | user choice; simplest |
| Draw rule | none in v1 | threefold repetition | user choice; smallest scope |
| Opponent | hotseat only | +AI | user choice; AI trivial to add later |
| Template | `phaserjs/template-react-ts` | hand-rolled Vite setup | official, maintained, EventBus included |
| Resolution | 720×1280, Scale.FIT, CENTER_BOTH | RESIZE + manual layout | FIT gives desktop pillar for free |
| Graphics | procedural (Graphics API) v1 | sprites now | no asset dependency; manifest seam reserved |
| Engine placement | pure TS, no Phaser imports | logic in scene | testability, mode reuse, user's maintainability ask |
| Restart | full reset to initial state, P1 (red) starts | loser starts | simplest v1; loser-starts kept as open question |
| Board render data | declarative strokes (segment/arc) on GameModeDef | hardcode drawing in scene | keeps BoardScene generic — scene with hardcoded arc breaks the mode-2 hypothesis |

---

## Research Summary

**Market Context**
Mode 1 = placement variant of umul gonu / Pong Hau K'i family (traditional 5-vertex trap games, Korea/China). Known playable, known trap patterns. This variant adds a placement phase (traditional game uses fixed starting positions).

**Technical Context**
Official `phaserjs/template-react-ts` provides Phaser 4.0.0 + React 19 + TS + Vite 6 + EventBus bridge and hot reload; dev server on :8080; ships `log.js` telemetry (removed in phase 1). No existing code in this repo (empty, fresh git).

**Board Drawing Reference**
Source sketch: circle + cross, gap at bottom-right quadrant. ASCII normative version in Game Rules section.

---

*Generated: 2026-07-14*
*Status: REVIEWED — adversarially refuted by 2 agents 2026-07-14; math claims survived exhaustive enumeration; 10 findings applied (render-data seam, T7 placement-trap vector, engine signatures, slide-rule wording, gameover semantics, radians footgun, letterbox spec, decisions-log gaps)*
