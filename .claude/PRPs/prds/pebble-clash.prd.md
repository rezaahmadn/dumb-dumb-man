# Pebble Clash — Jump-to-Eliminate Game Mode

## Problem Statement

The game currently ships two "get-your-pebbles-into-a-shape" modes (Well / Pebble Trap, Three-in-a-Row) — both small boards, ≤3 pebbles, win by trapping or aligning. There is no *elimination* mode: no capture, no large board, no "clear the opponent off the board" arc. Players who want a meatier, chess/checkers-flavoured duel have nothing here, and the project (a testbed for ECC workflows) has no mode that exercises capture mechanics, chained moves, or a heuristic AI.

## Evidence

- Repo has exactly two modes registered (`src/game/modes/registry.ts`): `well`, `morris`. Both `pebblesPerPlayer` ≤ 3, both win by `trap`/`alignment` — no capture path exists anywhere in `engine/`.
- `Move` type (`src/game/engine/types.ts:31`) is `place | move | pass` — no jump/capture/chain variant.
- User request (2026-07-16): explicit spec for a 16-pebble-per-side, pre-placed, jump-to-eliminate mode with chained captures, a low-count "flying" rule, plus a vs-AI opponent alongside 2-player hotseat.
- Assumption to validate: that a checkers/Alquerque-family mode is fun on *this* board geometry — validated only by playtest after MVP.

## Proposed Solution

Add a third mode, **Pebble Clash**: a draughts/Alquerque-family game on a large lined board. 16 pebbles per player, pre-placed on each side, centre row empty. Players move one pebble along a drawn line to an adjacent empty vertex; they may instead **jump** an adjacent opponent pebble (landing on the empty vertex immediately beyond) to capture it, and a jump **chains** as far as it can go in one turn. A player reduced to ≤3 pebbles gains long-range ("flying") movement. Win by eliminating all of the opponent's pebbles (or leaving them with no legal move). A greedy, capture-preferring AI provides the solo opponent.

We build this by **extending the existing data-driven engine**, not bolting on a parallel system: a new `jump` move variant, a `win: 'elimination'` condition, a `preplaced` board seeding, a `flyingThreshold`, and a separate greedy AI path (the current retrograde solver cannot scale to 16 pebbles). The board itself stays pure data (`GameModeDef`), so mode selection and the vs-AI toggle come for free via the existing registry / `OpponentSelect` wiring.

## Key Hypothesis

We believe a **jump-to-eliminate mode with chained captures and a greedy AI** will give players a deeper, chess-like duel — and give the project a capture-mechanic testbed — for both hotseat and solo players.
We'll know we're right when a full game can be played to elimination in both hotseat and vs-AI, the AI reliably takes an available capture, and chained multi-jumps resolve correctly (verified by the rules test-suite + a manual browser playthrough).

## What We're NOT Building

- **Flying long-range captures** — the ≤3 rule grants long *movement* only; captures stay short-jump (land immediately beyond). Deferred to keep chain logic tractable for the implementer. (Open Q1.)
- **Mandatory capture** — user chose *optional* capture; we will not add a "must jump" legality filter.
- **Directional (forward-only) movement** — checkers restricts men to forward; the spec doesn't, so pebbles move any direction along a line. No promotion/king concept beyond the flying rule.
- **A strong / deep-search AI** — user chose greedy + shallow. No alpha-beta, no opening book.
- **Board editor, variable board sizes, custom pebble counts** — the board is one fixed transcription of the supplied image.
- **Networked / online multiplayer** — hotseat + local AI only, matching existing modes.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Full game completes (hotseat) | Reaches `gameover` with one side at 0 pebbles | Manual browser playthrough + rules test |
| Full game completes (vs AI) | AI plays legal moves to a terminal state | Manual browser playthrough |
| AI takes available capture | 100% when a single capture is on offer | Deterministic unit test in `aiGreedy.test.ts` |
| Chain capture correctness | Maximal chain removes every jumped pebble | Unit tests: 2-hop, 3-hop, branching chains |
| Regression | `npm test` + `npm run typecheck` green | CI / local |
| Board fidelity | 16 pebbles/side, centre row empty, matches image | Assertion test on the mode's `preplaced` + hand-check vs image |

## Open Questions

- [ ] **Q1 (flying + capture):** Does a ≤3-pebble player also capture at range, or only move at range? Assumed: move only; captures stay short-jump.
- [ ] **Q2 (edge rule):** "Along the edge can only move to one vertex" — assumed to mean *perimeter lines permit single-step moves only* (no long slide along the outer edge, even when flying). Needs confirmation against intended play.
- [x] **Q3 (board geometry): RESOLVED.** Board identified as the traditional **Sixteen Soldiers** board (5×5 Alquerque + triangular wing top and bottom). Full transcription in [Board Geometry](#board-geometry) below; source image committed at `docs/pebble-clash-board.png`. Counts verified: 37 vertices, 16/side, centre row of 5 empty.
- [ ] **Q4 (chain disambiguation):** When two different maximal chains end on the same landing vertex, which does the UI apply? v1 picks the longest, then the first found.
- [ ] **Q5 (loss by no-move):** A player who still has pebbles but no legal move — do they lose? Assumed yes (opponent wins), matching a trap.
- [ ] **Q6 (name):** Mode name "Pebble Clash" / id `clash` is provisional.

---

## Users & Context

**Primary User**
- **Who**: A casual player of this mobile-first board-game app who already tried the two existing modes and wants a longer, more strategic match; and the project owner using the app to exercise ECC/agent workflows on a capture-based game.
- **Current behavior**: Plays Well / Three-in-a-Row — short games, no capture.
- **Trigger**: Opens the app, wants a deeper duel, or wants a solo game vs the computer.
- **Success state**: Plays a complete Pebble Clash game to elimination, hotseat or vs AI, with captures and chains working as expected.

**Job to Be Done**
When I want a deeper, chess-like duel on this app (solo or with a friend), I want a jump-to-eliminate mode with chained captures, so I can outmaneuver and wipe out my opponent's pebbles.

**Non-Users**
Players wanting online multiplayer, a tunable/large-board variant, or a tournament-strength AI. Not targeted in v1.

---

## Board Geometry

Source image: `docs/pebble-clash-board.png`. This is the traditional **Sixteen Soldiers** board — a 5×5 Alquerque grid with a triangular wing above and below. Transcribed onto the existing 720×1280 portrait canvas using the established `x ∈ [90, 630]` margin convention (`well`, `morris`).

**Construction**: uniform cell = **135px**. Grid columns `x = 90, 225, 360, 495, 630`. Grid rows `y = 370, 505, 640, 775, 910`. Each wing is 2 cells tall with 45° slants, so its crossbar sits 1 cell from the apex at half-width, and its base 2 cells out at full grid width. Board spans `y = 100 → 1180`, centred on the canvas (`y = 640` = grid centre row = canvas midpoint).

**Vertex ids** — `g{row}{col}` for the grid (row 0 = top, col 0 = left); `t*` / `b*` for top / bottom wings (`*b` = base, `*c` = crossbar).

| Group | Ids | Coordinates |
|-------|-----|-------------|
| Top wing base | `tb0`, `tb1`, `tb2` | `(90,100)`, `(360,100)`, `(630,100)` |
| Top wing crossbar | `tc0`, `tc1`, `tc2` | `(225,235)`, `(360,235)`, `(495,235)` |
| Grid row 0 | `g00`…`g04` | `y=370`, `x = 90/225/360/495/630` |
| Grid row 1 | `g10`…`g14` | `y=505`, same x |
| Grid row 2 (centre) | `g20`…`g24` | `y=640`, same x |
| Grid row 3 | `g30`…`g34` | `y=775`, same x |
| Grid row 4 | `g40`…`g44` | `y=910`, same x |
| Bottom wing crossbar | `bc0`, `bc1`, `bc2` | `(225,1045)`, `(360,1045)`, `(495,1045)` |
| Bottom wing base | `bb0`, `bb1`, `bb2` | `(90,1180)`, `(360,1180)`, `(630,1180)` |

**Total: 37 vertices** (25 grid + 6 + 6). The wing apexes are *not* new vertices — the top wing converges on `g02`, the bottom on `g42`.

### Lines (24)

Adjacency and capture directions derive entirely from these; consecutive ids in a line are adjacent.

```
Grid horizontals (5)
  [g00 g01 g02 g03 g04]  [g10 g11 g12 g13 g14]  [g20 g21 g22 g23 g24]
  [g30 g31 g32 g33 g34]  [g40 g41 g42 g43 g44]

Grid verticals (5) — the centre column runs unbroken through both wings
  [g00 g10 g20 g30 g40]
  [g01 g11 g21 g31 g41]
  [tb1 tc1 g02 g12 g22 g32 g42 bc1 bb1]     <- 9 vertices, one continuous line
  [g03 g13 g23 g33 g43]
  [g04 g14 g24 g34 g44]

Grid diagonals (6) — standard Alquerque "X + diamond"
  [g00 g11 g22 g33 g44]      long, TL->BR
  [g04 g13 g22 g31 g40]      long, TR->BL
  [g02 g11 g20]              diamond NW
  [g02 g13 g24]              diamond NE
  [g20 g31 g42]              diamond SW
  [g24 g33 g42]              diamond SE

Top wing (4)
  [tb0 tb1 tb2]              base
  [tc0 tc1 tc2]              crossbar
  [tb0 tc0 g02]              left slant   (diagonal)
  [tb2 tc2 g02]              right slant  (diagonal)

Bottom wing (4)
  [bb0 bb1 bb2]              base
  [bc0 bc1 bc2]              crossbar
  [bb0 bc0 g42]              left slant   (diagonal)
  [bb2 bc2 g42]              right slant  (diagonal)
```

`boardStrokes`: every line is straight, so each renders as one `{ kind: 'segment', from: <first>, to: <last> }` — 24 strokes, no arcs.

### Pre-placed setup

| Player | Ids | Count |
|--------|-----|-------|
| 2 (top) | `tb0 tb1 tb2 tc0 tc1 tc2` + `g00`…`g04` + `g10`…`g14` | 16 |
| 1 (bottom) | `bb0 bb1 bb2 bc0 bc1 bc2` + `g30`…`g34` + `g40`…`g44` | 16 |
| — (empty) | `g20`…`g24` (centre row) | 5 |

37 = 16 + 16 + 5 ✓ — the traditional Sixteen Soldiers opening position.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Pre-placed 16v16 board, centre row empty | The mode's identity; no placement phase |
| Must | Step move to adjacent empty vertex along a line | Base movement |
| Must | Jump-capture (land immediately beyond an adjacent opponent) | Core elimination mechanic |
| Must | Forced-maximal chain within a chosen jump | User-specified, unlimited chaining |
| Must | `win: 'elimination'` (opponent at 0 pebbles, or no legal move) | Win condition |
| Must | Flying movement when a player has ≤3 pebbles | User-specified comeback rule |
| Must | Greedy capture-preferring AI (deterministic) | Solo opponent; retrograde solver can't scale to k=16 |
| Must | Mode registered + selectable, hotseat + vs AI | Delivery via existing menu/registry wiring |
| Should | Capture animation (hop + captured pebble removal) | Legibility of what happened |
| Should | Highlight legal jump landings distinctly from quiet moves | Playability |
| Could | 1–2 ply AI lookahead beyond greedy | Slightly stronger opponent |
| Could | Chain "step-through" UI (tap each hop) | Nicer than auto-resolving maximal chain |
| Won't | Flying captures, mandatory capture, forward-only rule, online, board editor | Out of scope (see above) |

### MVP Scope

A registered `clash` mode that: seeds 16v16 pre-placed pebbles and renders them; lets a player step or jump-capture (with forced-maximal chaining); ends the game by elimination or no-move; grants flying at ≤3 pebbles; and offers a greedy AI opponent. Playable start-to-finish in hotseat and vs AI. Board geometry transcribed from the supplied image (Q3).

### User Flow

1. Main menu → tap **Pebble Clash**.
2. Opponent select → **Hotseat** or **Solo (vs AI)**.
3. Board shows with all 32 pebbles pre-placed, centre row empty.
4. Tap a pebble → legal quiet-move + jump landings highlight.
5. Tap a destination: a quiet move relocates one vertex; a jump landing performs the (maximal) capture chain, removing jumped pebbles.
6. Turn passes. If vs AI, AI responds (prefers captures).
7. Repeat until one side reaches 0 pebbles (or has no legal move) → HUD shows winner; Restart available.

---

## Technical Approach

**Feasibility**: MEDIUM. The board is pure data (easy), and menu/AI-toggle wiring is free. But capture, chaining, pre-placed start, elimination win, and a new AI break four assumptions baked into `engine/` and `BoardScene.ts`, so this is real engine + scene work — larger than either existing mode. It is well-bounded and self-containable for a lower-tier implementer (haiku) if the plan spells out each file.

**Architecture Notes** (all references verified in the current tree)
- **`engine/types.ts`** — additive changes only:
  - New `Move` variant: `{ kind: 'jump'; from: VertexId; hops: { over: VertexId; to: VertexId }[] }` (a chain = ordered hops; `over` = captured vertex, `to` = landing).
  - `EngineConfig`: add `win: 'elimination'` to the union; add `movement: 'draughts'`; add `preplaced?: { 1: VertexId[]; 2: VertexId[] }`; add `flyingThreshold?: number` (default 3).
- **`engine/rules.ts`**:
  - `initialState`: if `preplaced` present, seed those vertices and start `phase: 'movement'` (skip placement). Existing modes (no `preplaced`) keep starting in `placement` — no regression.
  - `legalMoves` `'draughts'` branch: quiet steps to adjacent empty (1 vertex; long slide only when the mover's pebble count ≤ `flyingThreshold`, honouring the edge rule Q2); jump enumeration per mover pebble along each line direction, recursively extended to **maximal** chains (Q4 tie-break). Because capture is optional, quiet moves and jumps are both returned.
  - `applyMove`: `jump` removes every `hop.over`, relocates the pebble `from → last hop.to`. Elimination win: after any move, if opponent pebble count == 0 → mover wins. No-move loss (Q5): if the next player has 0 legal moves → previous mover wins (reuse existing trap-style check, gated to `win: 'elimination'`).
  - Count helper: `pebbleCount(board, player)`.
- **New `engine/aiGreedy.ts`** (pure, deterministic, no RNG): score each legal move — captures-in-chain first, then a material/mobility heuristic; stable tie-break by move ordering so tests are deterministic. Do **not** call `solveMovementGraph` for this mode.
- **AI dispatch**: `chooseMove` (or `BoardScene.maybeScheduleAiMove`) branches on `cfg.win === 'elimination'` / `movement === 'draughts'` to use `aiGreedy` instead of the retrograde solver. Existing modes unaffected.
- **`modes/clash/index.ts`** + **`modes/registry.ts`**: new `GameModeDef` (board vertices/lines/strokes from Q3 + `preplaced` + config). Register → auto-appears in `MainMenu`. No menu code changes.
- **`scenes/BoardScene.ts`**:
  - `create()`: for a `preplaced`/movement-start mode, spawn pebble objects for all seeded vertices (today objects are only created on a `place` move — pre-placed pebbles would otherwise be invisible).
  - `syncPebbles` / tap flow: handle the `jump` move — animate the pebble through each hop and `destroy()` each captured pebble object; highlight jump landings. Chain disambiguation per Q4.
  - AI seat (`AI_PLAYER = 2`), delayed-call scheduling, drag/tap machine: reused as-is.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Retrograde AI accidentally invoked at k=16 (hang/OOM) | H | Hard dispatch on mode; unit test asserts `clash` never calls `solveMovementGraph` |
| Chain enumeration bug (infinite loop / re-jumping a removed pebble) | M | Enumerate on a working board copy that removes captured pebbles as the chain extends; visited-guard; TDD with branching-chain cases |
| Board geometry mis-transcribed from image | M | Phase 1 isolated; assertion test on counts + hand-verify vs image before building on it |
| Scene assumes atomic single-pebble moves | M | Explicit `jump` render path; keep engine as source of truth, scene only reflects it |
| Edge/flying rules under-specified (Q1/Q2) | M | Ship the documented assumptions; leave config seams (`flyingThreshold`, per-line edge flag) so behaviour is tunable without a rewrite |
| Optional-capture + forced-chain interaction confusing to players | L | Highlight jumps distinctly; auto-resolve maximal chain in v1 |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Board transcription | ~~Transcribe the image~~ **Done in-PRD** — see [Board Geometry](#board-geometry). Phase 5 transcribes that table into `clash/index.ts` verbatim. | complete | - | - | n/a |
| 2 | Engine types + pre-placed init | Add `jump` move, `elimination` win, `draughts` movement, `preplaced`, `flyingThreshold`; seed movement-start in `initialState` | complete | - | - | [phase-2](../plans/completed/pebble-clash-phase-2-engine-types.plan.md) / [report](../reports/pebble-clash-phase-2-engine-types-report.md) |
| 3 | Movement + capture rules | `legalMoves`/`applyMove` for steps, flying, jump chains, elimination + no-move win — TDD | in-progress | - | 2 | [phase-3](../plans/pebble-clash-phase-3-movement-capture-rules.plan.md) |
| 4 | Greedy AI | `aiGreedy.ts` capture-preferring deterministic AI + mode dispatch | pending | with 5 | 3 | [phase-4](../plans/pebble-clash-phase-4-greedy-ai.plan.md) |
| 5 | Mode def + registry | Assemble `clash/index.ts` `GameModeDef` from the Board Geometry table, register it; add the board-fidelity assertion test (from Phase 1) | pending | with 4 | 3 | [phase-5](../plans/pebble-clash-phase-5-mode-def-registry.plan.md) |
| 6 | Scene rendering | Seed pre-placed pebbles in `create()`; render jump (hops + captured removal); jump-landing highlights | pending | - | 5 | [phase-6](../plans/pebble-clash-phase-6-scene-rendering.plan.md) |
| 7 | Verify | Full test-suite + typecheck green; manual browser playthrough hotseat + vs AI | pending | - | 4, 6 | [phase-7](../plans/pebble-clash-phase-7-verify.plan.md) |

### Phase Details

**Phase 1: Board transcription — COMPLETE (resolved during PRD review, 2026-07-16)**
- **Outcome**: Board identified as the traditional Sixteen Soldiers board; full vertex / line / `preplaced` transcription now lives in [Board Geometry](#board-geometry), image committed at `docs/pebble-clash-board.png`.
- **Why it collapsed into the PRD**: the geometry is regular (135px cell, 45° wing slants on the existing 90→630 grid convention), so it reduced to a data table rather than an implementation task. No separate plan needed — Phase 5 copies the table into `clash/index.ts`.
- **Residual work (moves to Phase 5)**: the count-assertion test (37 vertices, 16/side, no overlap, centre row empty) and the hand-check against the image.

**Phase 2: Engine types + pre-placed init**
- **Goal**: Type + state foundations, no behaviour yet.
- **Scope**: Additive edits to `engine/types.ts`; `initialState` seeds `preplaced` and starts in `movement`. Existing modes unchanged.
- **Success signal**: `npm run typecheck` green; a test shows `initialState(clashCfg)` yields 16/16 pebbles, `phase: 'movement'`; `well`/`morris` still start in `placement`.

**Phase 3: Movement + capture rules**
- **Goal**: Correct legality + application for the whole rule set.
- **Scope**: `legalMoves` `draughts` branch (quiet step; flying slide at ≤ threshold; maximal jump chains, optional capture); `applyMove` jump handling + captured removal; `win: 'elimination'` + no-move loss; `pebbleCount` helper. TDD.
- **Success signal**: New `rules` tests pass — single jump, 2/3-hop chain, branching chain (Q4 tie-break), flying move appears only at ≤3, elimination win, no-move loss. Existing tests green.

**Phase 4: Greedy AI**
- **Goal**: A deterministic solo opponent that never hangs.
- **Scope**: `engine/aiGreedy.ts` (prefer captures / longest chain, then material+mobility heuristic, stable tie-break); dispatch so `clash` uses it and never `solveMovementGraph`.
- **Success signal**: `aiGreedy.test.ts` — takes the only capture; prefers the longer chain; returns a legal move on a fresh board; a guard test proves the retrograde solver is not called for `clash`.

**Phase 5: Mode def + registry**
- **Goal**: The mode exists and is selectable.
- **Scope**: `modes/clash/index.ts` assembles the Phase-1 board + config; add to `MODES`.
- **Success signal**: "Pebble Clash" appears in the menu; selecting it loads a movement-phase state with 32 pebbles.

**Phase 6: Scene rendering**
- **Goal**: The mode is playable and legible.
- **Scope**: `BoardScene.create()` seeds pre-placed pebble objects; jump render path (animate hops, `destroy()` captured); distinct jump-landing highlights; chain disambiguation (Q4).
- **Success signal**: In-browser, all 32 pebbles show; tapping a pebble highlights quiet + jump destinations; a capture removes the jumped pebble(s); a chain resolves in one turn.

**Phase 7: Verify**
- **Goal**: Confidence it works end-to-end.
- **Scope**: `npm test`, `npm run typecheck`; manual playthrough hotseat + vs AI to a terminal state; check winner display + restart.
- **Success signal**: All green; both game types reach `gameover` correctly.

### Parallelism Notes

Phase 1 is done (board data lives in this PRD), so **Phase 2 is the entry point** and needs no stub — it can read the real `preplaced` list straight from the Board Geometry table. Phase 3 follows 2. Phases 4 and 5 can then run together (AI needs rules; mode def needs the geometry table + rules). Phase 6 needs the registered mode (5); Phase 7 needs both the AI (4) and the scene (6).

Critical path: **2 → 3 → (4 ‖ 5) → 6 → 7**.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Capture obligation | Optional | Mandatory (checkers/Fanorona) | User choice; simpler legality + AI |
| Chain within a jump | Forced-maximal | Stop-anytime | User choice; classic multi-jump |
| AI strength | Greedy + shallow, deterministic | Minimax α-β | User choice; easy for haiku, no-RNG = testable; retrograde solver can't scale to k=16 |
| Flying (≤3) applies to | Movement only | Movement + capture | Keeps chain logic tractable (Q1, revisitable) |
| Move direction | Any along a line | Forward-only + kinging | Spec silent; simplest faithful reading |
| Engine strategy | Extend data-driven engine | Parallel capture subsystem | Reuses registry/menu/AI-seat wiring; one source of truth |
| Board source | Transcribe supplied image | Invent a grid | User: "exactly like the image" |
| Mode name/id | "Pebble Clash" / `clash` | Draughts/Siege/Duel | Provisional (Q6) |

---

## Research Summary

**Market Context**
This is the Alquerque family (Alquerque → checkers/draughts, Fanorona): pre-placed pieces on a lined board, capture by short jump over an adjacent enemy to the empty point beyond, multi-jump chains, win by elimination. Fanorona notably features long chained captures and a low-count endgame dynamic — good prior art for chaining and the ≤3 flying rule. Common pitfalls the design already accounts for: infinite re-jump loops (remove captured pieces from the working board mid-chain), and search blow-up on large boards (greedy/heuristic instead of full solve).

**The board is a specific traditional game** (identified 2026-07-16 from the supplied image): **Sixteen Soldiers** — also known as Sholo Guti (Bangladesh), Cows and Leopards, or Gala. A 5×5 Alquerque grid with a triangular wing top and bottom, 37 points, 16 soldiers per side pre-placed, centre row of 5 left empty. The spec's headline numbers are therefore not arbitrary — they *are* the traditional opening position, which independently corroborates the transcription (37 − 32 = 5 ✓). Traditional rules match this PRD on: any-direction movement along lines, optional capture by short jump, and unlimited multi-jump chains. **The ≤3 flying rule is a house rule**, not part of the traditional game — so Q1/Q2 cannot be settled by appeal to the standard rules and stay open as user decisions.

**Technical Context**
- Engine is strictly data-driven and self-contained (`engine/` imports nothing outside itself) — new mode = data + additive rule branches, no cross-layer leakage.
- Existing `Move`/`applyMove`/`legalMoves` are atomic; capture + chain is the one genuinely new engine shape. Verified: `src/game/engine/types.ts:31` (`Move`), `rules.ts:28` (`legalMoves`), `rules.ts:108` (`applyMove`), `ai.ts:132` (`chooseMove` → `solveMovementGraph`, full enumeration — must be bypassed here).
- UI is already mode-agnostic: `MainMenu` renders every registered mode; `OpponentSelect` gives human/ai; `main.ts` threads `modeId` + `opponentType`; `BoardScene` draws only from `GameModeDef`. The one scene assumption to break is object seeding for pre-placed pebbles + the jump render path.

---

*Generated: 2026-07-16*
*Updated: 2026-07-16 — Q3 resolved (board transcribed, Phase 1 complete); board identified as traditional Sixteen Soldiers.*
*Status: READY TO PLAN. Blocking question Q3 is closed. Q1/Q2/Q4/Q5/Q6 remain open but each ships a documented assumption behind a config seam (`flyingThreshold`, per-line edge flag), so they are tunable post-playtest without a rewrite — they do not block Phases 2–7.*
