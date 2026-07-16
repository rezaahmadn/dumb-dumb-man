# Three-in-a-Row — Mode 2: Alignment Board (Three Men's Morris)

Second game mode for the existing Phaser 4 + React + TypeScript app. Same 3-layer
architecture (pure engine / generic BoardScene / React shell). This PRD covers Mode 2
only and reuses everything Mode 1 ("Well Board") already built.

Spec style: terse, normative. Every rule is exact. Written so a smaller AI model
(e.g. Haiku) can implement it without guessing. Where a value or file already exists in
the repo, it is named with a path.

---

## Problem Statement

Reza wants a second, distinct board game in the same app. Mode 1 ("Well Board") is a
*trap* game (win = immobilize the opponent). Mode 2 is an *alignment* game (win = get your
own 3 pebbles in a straight line). The engine today hard-codes the trap win rule and an
any-distance slide movement rule. The risk to solve for: adding an alignment game must NOT
require rewriting the engine or the renderer — the whole point of Mode 1's architecture was
that new modes are cheap. Cost of not solving cleanly: a parallel copy of the engine.

## Evidence

- Mode 2 is **Three Men's Morris** (a.k.a. Tapatan / Achi / Nine Holes) — a centuries-old,
  provably playable traditional game. The board in the user's sketch (square + inner cross +
  both diagonals) is the exact Tapatan/Three Men's Morris board: a 3×3 grid of 9 points where
  the centre connects to all 8 outer points.
- Mode 1 already established the extension seam: `src/game/engine/types.ts:13` documents
  `EngineConfig` as the place to add "the optional rule-hook seam" and
  `.claude/PRPs/prds/pebble-trap.prd.md` line 30 pre-authorised exactly this change:
  *"If Mode 2 changes the rule shape, the one permitted engine change is adding the optional
  rule-hook seam to `EngineConfig` — a single planned edit, not a rewrite."*
- The existing generic renderer (`src/game/scenes/BoardScene.ts`) already draws any board
  from `GameModeDef` data and drives all interaction through `legalMoves`/`applyMove`. The
  menu (`src/ui/MainMenu.tsx`) already auto-lists every entry in the mode registry. The
  opponent picker (`src/ui/OpponentSelect.tsx`) already offers Solo(AI)/Hotseat generically.
  So "2-player mode and vs-AI mode" come almost entirely for free.

## Proposed Solution

Add two optional discriminators to `EngineConfig` and branch on them. Everything else is
data + one AI function.

1. **`win: 'trap' | 'alignment'`** (default `'trap'`) — Mode 1 stays trap; Mode 2 = alignment.
2. **`movement: 'slide' | 'step'`** (default `'slide'`) — Mode 1 stays slide; Mode 2 = single step.
3. **Mode 2 = one data file** (`src/game/modes/morris/index.ts`) + **one registry line**.
4. **One new AI branch** (`chooseMoveAlignment` in `src/game/engine/ai.ts`) for alignment mode.

Defaults are chosen so Mode 1 ("well") — which sets NEITHER field — behaves byte-for-byte as
today. No existing test may change.

## Key Hypothesis

We believe adding `win`/`movement` discriminators + one mode data file + one AI branch will
ship a complete second game (2-player and vs-AI) without rewriting `engine/rules.ts`'s core
shape or touching `BoardScene.ts`'s render/interaction logic.
We'll know we're right when: Mode 2 is fully playable (hotseat + AI), all Mode 1 tests still
pass unchanged, and the only edit to `BoardScene.ts` is a 1-line `pass` guard in `syncPebbles`
(required for strict compile; see §Renderer).

## What We're NOT Building (v2)

- Online multiplayer — hotseat + local AI only.
- AI difficulty selection — v2 ships ONE strong AI (near-perfect). Easy/Medium tiers deferred
  (Reza's decision).
- Modes 3+.
- Sound, accounts, persistence, animations beyond the existing move tween.
- A separate "pass" button UI — a forced pass (if it ever occurs) auto-applies (see §Pass).

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| New engine tests | 100% pass, includes A1–A12 below | `vitest` |
| Mode 1 regression | ALL existing tests in `rules.test.ts`, `ai.test.ts`, `sanity.test.ts` pass unchanged | `vitest` |
| Full game playable (hotseat) | place 6 → move → 3-in-a-row → win banner → restart, no errors | replay A3 + A6 by hand on device |
| Full game playable (vs AI) | AI plays optimally (exact solve): takes every forced win, blocks every immediate loss, never loses a position that isn't theoretically lost | A10/A11 + the initial-position value check (§AI) |
| Mode select | new mode appears as a 2nd menu button with ZERO edits to `MainMenu.tsx` | inspect menu |
| Portrait lock unchanged | board renders centred in the same 720×1280 pillar | resize window |

## Open Questions

- [ ] Final display name. This PRD uses **"Three-in-a-Row"** (menu label) and mode id
  **`morris`**. Rename freely — but the id is referenced by tests and the registry, so pick it
  before implementation and keep it stable.
- [ ] First-player advantage / centre-first. v2 allows centre on move 1 (Reza's decision). The exact
  AI solve COMPUTES the opening's true value at implementation time (see §AI). If it is a first-player
  forced win, ban centre on P1's first placement (isolated `legalMoves` tweak) to restore the known
  draw; otherwise leave as-is. Do not ship the "AI never loses" claim until this value is known.

---

## Users & Context

Same as Mode 1: two people sharing one phone (hotseat), or one person vs AI (Solo). Quick
casual games, 1–3 minutes, immediately clear who won. Non-users: online/ranked players.

**Job to be done:** *When we have a few idle minutes, I want a quick tactical alignment game
on one phone (or against the AI solo), so I can have fun without setup.*

---

## Game Rules (NORMATIVE — implement exactly this)

### Board: "Alignment Board" (3×3 grid)

9 vertices. A square, an inner cross (horizontal + vertical mid-lines), and both diagonals —
all crossing at the centre. Matches the user's sketch. (Rounded corners in the sketch are
cosmetic; draw straight sides.)

```
 TL ---- T ---- TR
  | \    |    / |
  |   \  |  /   |
  L ---- C ---- R
  |   /  |  \   |
  | /    |    \ |
 BL ---- B ---- BR
```

Vertex ids (9): `TL T TR L C R BL B BR` — top-left, top, top-right, left, centre, right,
bottom-left, bottom, bottom-right.

**Design-space coordinates** (reuse Mode 1's 540×540 box centred on (360,560) in the
720×1280 portrait design space, so both boards sit identically):

```ts
vertices: [
  { id: 'TL', x:  90, y: 290 }, { id: 'T', x: 360, y: 290 }, { id: 'TR', x: 630, y: 290 },
  { id: 'L',  x:  90, y: 560 }, { id: 'C', x: 360, y: 560 }, { id: 'R',  x: 630, y: 560 },
  { id: 'BL', x:  90, y: 830 }, { id: 'B', x: 360, y: 830 }, { id: 'BR', x: 630, y: 830 },
]
```

**Lines (8)** — THE central data structure. In this mode `lines` serves BOTH purposes at once:
- **Win-lines**: a player wins by owning all 3 vertices of any one line.
- **Movement adjacency source**: single-step edges are the consecutive pairs of each line
  (derived by the existing `edgesFromLines`/`adjacency` in `src/game/engine/board.ts` — NO
  change needed).

```ts
lines: [
  ['TL','T','TR'],  // top row
  ['L','C','R'],    // middle row
  ['BL','B','BR'],  // bottom row
  ['TL','L','BL'],  // left column
  ['T','C','B'],    // middle column
  ['TR','R','BR'],  // right column
  ['TL','C','BR'],  // main diagonal
  ['TR','C','BL'],  // anti-diagonal
]
```

**Derived adjacency** (MUST equal this — encode as test A1). Centre has degree 8; every other
vertex has degree 3:

```
TL: [C, L, T]          T: [C, TL, TR]        TR: [C, R, T]
L:  [BL, C, TL]        C: [B, BL, BR, L, R, T, TL, TR]   R: [BR, C, TR]
BL: [B, C, L]          B: [BL, BR, C]        BR: [B, C, R]
```

Note the movement graph among the 8 outer vertices is the square perimeter (an 8-cycle):
`TL–T–TR–R–BR–B–BL–L–TL`. Each outer vertex's non-centre neighbours are its two perimeter
neighbours. Corners reach the centre only via a diagonal; edges reach the centre via a
mid-line. You CANNOT step directly from one corner to another (must pass through an edge or
the centre in two turns).

### Players

- Player 1 = red pebbles. Player 2 = blue pebbles. **3 pebbles each** (`pebblesPerPlayer: 3`).
- Player 1 always moves first.
- Turns strictly alternate. (Exception: a forced `pass` — see §Pass — which is essentially
  unreachable; see the invariant note there.)

### Phase 1: Placement

1. Board starts empty.
2. Turn order P1, P2, P1, P2, P1, P2 — one pebble per turn until each player has placed 3
   (6 placements total = `2 × pebblesPerPlayer`).
3. A pebble may be placed on ANY empty vertex, **including the centre `C`**, from move 1.
4. Placement is never blocked (an empty vertex always exists during placement).
5. **A player can win during placement.** After each placement, check alignment (below). Since
   a win needs all 3 of one player's pebbles on a line, the earliest possible win is a player's
   3rd placement (P1's = the 5th placement overall; P2's = the 6th). If the 3rd placement
   completes a line, the game ends immediately — the remaining placements are not played.
6. If all 6 pebbles are placed and nobody is aligned, phase becomes `movement`, current player
   becomes P1.

### Phase 2: Movement (single step)

1. On your turn, move exactly one of your own pebbles to an **adjacent empty vertex** (one step
   along a drawn line — use the adjacency table above).
2. No sliding past a vertex, no jumping. Destination must be directly adjacent AND empty.
3. A pebble whose every neighbour is occupied simply contributes no moves (it is not movable
   this turn). You choose freely among your movable pebbles. This is the "skip a blocked
   pebble" behaviour — it is automatic (blocked pebbles just aren't offered).
4. After the move, check alignment (below). If the mover now owns all 3 vertices of any line,
   they win immediately.

### Pass (forced skip — defensive; see invariant)

If, in the movement phase, the player to move has **no** legal piece-move (ALL three of their
pebbles are fully surrounded), they must **pass**: the turn goes to the opponent, the board is
unchanged.

- Represented so the move pipeline stays uniform: `legalMoves` returns exactly
  `[{ kind: 'pass' }]` in that situation (only when `win === 'alignment'`). It is NEVER empty in
  a non-`gameover` alignment movement state.
- `applyMove({kind:'pass'})` flips `current`, leaves `board`/`placed` unchanged, keeps
  `phase === 'movement'`, and records the resulting position in `history` (so repeated mutual
  passes converge to a draw via threefold repetition).

> **Invariant (why this is defensive):** total immobilisation appears to be UNREACHABLE before
> someone has already won. To immobilise all 3 of a player's pebbles you must occupy every one
> of their neighbours; with only 3 empty cells on a 9-cell board this forces the opponent to
> occupy a full line through the centre (two opposite outer points + `C`, or two opposite
> corners + `C`) — i.e. the opponent is already aligned and the game already ended. Implement
> `pass` anyway: it keeps the engine and the AI *total* (never handed an empty move list) and
> honours the user's "skip if blocked" model. Test it with a synthetic board (A7) that bypasses
> reachability.

### Win Condition (Alignment)

After every applied `place` or `move` (NOT needed after `pass` — board unchanged): if the
**mover** now owns all 3 vertices of any line in `lines`, the mover wins immediately.

- `alignedPlayer(cfg, board)`: for each `line` in `cfg.board.lines`, if all its vertices are
  non-null and equal to the same player `P`, return `P`; else return `null`. Only the mover can
  create a new full line on their own move, so a non-null result is always the mover.
- On gameover: `phase:'gameover'`, `winner` = the mover, `current` = the opponent (already
  flipped). Display reads `winner`. (Same convention as Mode 1.)

### Draw (threefold repetition)

Reuse Mode 1's mechanism verbatim: `repetitionLimit: 3`. In the movement phase, if the same
position (board layout + side-to-move, via the existing `positionKey`) occurs for the 3rd time,
the game is a draw (`phase:'gameover'`, `winner:null`). Placement positions strictly gain
pebbles and never repeat, so they are never keyed (same as Mode 1). A win always takes priority
over a draw on the same move (already true in `applyMove`'s ordering — win check returns before
the repetition check).

---

## Engine Changes (NORMATIVE)

All edits stay inside `src/game/engine/` and are ADDITIVE. Mode 1's `well` config sets neither
`win` nor `movement`, so every default below reproduces today's behaviour exactly.

### 1. Types — `src/game/engine/types.ts`

```ts
export interface EngineConfig {
  board: BoardDef;
  pebblesPerPlayer: number;
  repetitionLimit?: number;
  movement?: 'slide' | 'step';   // default 'slide' (Mode 1 unchanged); Mode 2 = 'step'
  win?: 'trap' | 'alignment';    // default 'trap' (Mode 1 unchanged); Mode 2 = 'alignment'
}

export type Move =
  | { kind: 'place'; to: VertexId }
  | { kind: 'move'; from: VertexId; to: VertexId }
  | { kind: 'pass' };            // NEW — only produced/consumed when win === 'alignment'
```

### 2. legalMoves — `src/game/engine/rules.ts`

Placement branch: **unchanged**.

Movement branch: first compute the piece-moves by `cfg.movement ?? 'slide'`, THEN append the forced
pass by `cfg.win` (tie the pass to the win rule, NOT to the movement style — so a hypothetical
future `slide` + `alignment` mode also gets a pass instead of an empty list):

```ts
// phase === 'movement'
let moves: Move[];
if ((cfg.movement ?? 'slide') === 'step') {
  const adj = adjacency(cfg.board);             // from './board'
  moves = [];
  for (const v of Object.keys(s.board)) {
    if (s.board[v] !== s.current) continue;
    for (const n of adj[v]) {
      if (s.board[n] === null) moves.push({ kind: 'move', from: v, to: n });
    }
  }
} else {
  moves = /* EXISTING slide code (today's lines 31–52), unchanged */;
}
// forced pass ONLY in alignment mode when otherwise stuck (see §Pass invariant). Keyed on
// win === 'alignment', independent of movement style.
if (moves.length === 0 && (cfg.win ?? 'trap') === 'alignment') {
  return [{ kind: 'pass' }];
}
return moves;
```

`legalMoves` of a `gameover` state is `[]` (unchanged). Trap mode (`win` defaulting to `'trap'`)
never appends a pass, so its zero-move result stays `[]` and the trap check still fires. Adjacency
lists are unordered; move order does not matter (tests compare as sets).

### 3. applyMove — `src/game/engine/rules.ts`

Extend the existing function. Additions in **bold intent**:

1. **Legality check — MUST add a `pass` arm** (the existing predicate only compares `place`/`move`
   and, once `Move` gains `pass`, both *rejects a legal pass at runtime* AND *fails to compile* under
   `strict` because its `else` branch reads `lm.from`/`lm.to`). Replace with:

   ```ts
   const legal = legalMoves(cfg, s).some((lm) =>
     lm.kind === 'pass'  ? m.kind === 'pass'
     : lm.kind === 'place' ? (m.kind === 'place' && lm.to === m.to)
     : (m.kind === 'move' && lm.from === m.from && lm.to === m.to)
   );
   if (!legal) throw new Error(`illegal move: ${JSON.stringify(m)}`);
   ```
2. Apply the move to a copied board:
   - `place` / `move`: unchanged.
   - **`pass`: board and `placed` unchanged.**
3. Compute `phase` exactly as today (`placement` while `placed[1]+placed[2] < 2*pebblesPerPlayer`,
   else `movement`). A `pass` only occurs in movement, so it keeps `phase === 'movement'`.
4. Build `next` with `current` flipped, `winner: null` (unchanged).
5. **Alignment win (new, BEFORE the trap/repetition block) — MUST be gated off `pass`:**

   ```ts
   if (m.kind !== 'pass' && (cfg.win ?? 'trap') === 'alignment') {
     const w = alignedPlayer(cfg, board);   // board = post-move board
     if (w !== null) return { ...next, phase: 'gameover', winner: w };
   }
   ```

   The `m.kind !== 'pass'` guard is REQUIRED, not cosmetic: a `pass` leaves the board unchanged, and
   by the §Pass invariant *every* board on which a pass is legal already has the OPPONENT aligned. So
   without the guard, `alignedPlayer` would return the opponent and the first pass would be reported
   as an (opponent) win — corrupting `winner`/`current` and killing the intended mutual-pass draw. A
   `pass` never creates a new alignment (only the mover could, and the mover didn't move a pebble), so
   skipping the check for `pass` is always safe. A `pass` falls straight through to the movement
   bookkeeping block below (history record + repetition check + return).
6. Movement bookkeeping block (mostly unchanged), with the trap check **gated off for alignment**:

   ```ts
   if (next.phase === 'movement') {
     // record history via positionKey (unchanged)
     ...
     // TRAP win — only for trap mode. In alignment mode a stuck player passes
     // instead (legalMoves returns [pass]), so never treat 0 piece-moves as a loss.
     if ((cfg.win ?? 'trap') !== 'alignment' && legalMoves(cfg, next).length === 0) {
       return { ...next, phase: 'gameover', winner: s.current };
     }
     // threefold repetition draw — unchanged (gated by cfg.repetitionLimit)
     if (cfg.repetitionLimit !== undefined && repeatCount >= cfg.repetitionLimit) {
       return { ...next, phase: 'gameover', winner: null };
     }
   }
   return next;
   ```

`applyMove` still returns a NEW state, never mutates inputs (including `history`) — keep the
existing immutable spreads.

### 4. alignedPlayer helper

Put it in `rules.ts` (used by `applyMove`) and export it (used by tests and, optionally, the AI):

```ts
export function alignedPlayer(cfg: EngineConfig, board: Record<VertexId, PlayerId | null>): PlayerId | null {
  for (const line of cfg.board.lines) {
    const first = board[line[0]];
    if (first !== null && line.every((v) => board[v] === first)) return first;
  }
  return null;
}
```

Correct for this mode because every win-line has length 3 and `pebblesPerPlayer` is 3, so a
fully-owned line means that player used all 3 pebbles on it.

### 5. AI — `src/game/engine/ai.ts`

Add an alignment brancher; leave the existing trap solver untouched. `chooseMove` dispatches:

```ts
export function chooseMove(cfg: EngineConfig, s: GameState): Move {
  if ((cfg.win ?? 'trap') === 'alignment') return chooseMoveAlignment(cfg, s);
  // ...existing trap-solver body unchanged...
}
```

`chooseMoveAlignment` is an EXACT solver that MIRRORS the shipped trap solver structure already in
`ai.ts` (`allLiveMovementNodes` → `solveMovementGraph` → `valueOfMove`/`valuePlacement` → argmax).
Do NOT use a depth-limited negamax: a depth cap with a draw-valued horizon can walk into a loss that
is forced beyond the horizon (every in-horizon line scores an equal 0). The state space is tiny and
fully solvable, giving provably optimal play. Only **two deltas** from the trap solver:

1. **k = `cfg.pebblesPerPlayer` = 3** in the movement-node enumeration (trap mode used 2 — the code
   already reads `cfg.pebblesPerPlayer`, so this is automatic).
2. **Terminal = alignment.** A movement node is *live* only when `alignedPlayer(cfg, board) === null`.
   In `allLiveMovementNodes`, add `&& alignedPlayer(cfg, board) === null` next to the existing
   `legalMoves(...).length > 0` filter. (`applyMove` already returns `gameover` when a move *creates*
   alignment, so the existing "`child.phase === 'gameover'` ⇒ win for the mover" edge handling in
   `solveMovementGraph`/`valueOfMove` is correct unchanged.)

Everything else — the retrograde WIN/LOSS/DRAW fixpoint over the movement graph, then the placement
minimax reusing those labels at the placement→movement boundary, then argmax over the root's legal
moves — is identical to the shipped trap solver. `chooseMove` dispatches to it when
`(cfg.win ?? 'trap') === 'alignment'`.

**Correct & terminating:**
- Movement graph size = `C(9,3)·C(6,3)·2 = 3360` nodes; the retrograde fixpoint is milliseconds.
- `pass` NEVER appears in the solve graph: a node with zero piece-moves has the opponent already
  aligned (proven in §Pass invariant), so the alignment filter excludes it. The AI never handles a
  `pass`.
- Placement positions strictly gain pebbles and never repeat, so the placement minimax is a finite
  tree (no repetition/TT concerns). A transposition table over movement is unnecessary (retrograde
  already visits each node once) — and would be UNSOUND if keyed on board+side alone, because draw
  values are repetition-dependent; the retrograde solve sidesteps this.

**Perf:** `adjacency(cfg.board)` (`board.ts`) rebuilds the graph on every call, and `legalMoves`
calls it per movement node. Memoise it (compute once and reuse) so the 3360-node solve doesn't
rebuild the same 9-node graph thousands of times. Not correctness-critical; do it anyway.

**Game value / "never loses" — stated honestly.** Because the solver is exact, the AI plays
optimally: it takes every forced win and never loses a position that is not *theoretically* lost.
Whether the AI (which plays P2 — human is P1 and moves first, `AI_PLAYER = 2` in `BoardScene`) can
always at least draw depends on the true value of THIS variant (single-step, diagonals, **centre
legal on move 1**). That value is NOT assumed — the exact solve computes it.
**Implementation step:** evaluate the initial position (`valuePlacement(initialState)` from P1's
perspective) and record the number. If it is a first-player forced win, centre-first is decisive and
the Solo AI (P2) will lose to perfect play — then resolve the "centre on move 1" open question by
banning centre on P1's first placement (an isolated `legalMoves` tweak) to restore the known draw.
If it is a draw, no action needed.

---

## Mode Definition (DATA — this is the whole mode)

`src/game/modes/morris/index.ts`:

```ts
import type { GameModeDef } from '../types';

export const MORRIS_MODE: GameModeDef = {
  id: 'morris',
  name: 'Three-in-a-Row',
  engine: {
    pebblesPerPlayer: 3,
    repetitionLimit: 3,
    movement: 'step',
    win: 'alignment',
    board: {
      vertices: [
        { id: 'TL', x:  90, y: 290 }, { id: 'T', x: 360, y: 290 }, { id: 'TR', x: 630, y: 290 },
        { id: 'L',  x:  90, y: 560 }, { id: 'C', x: 360, y: 560 }, { id: 'R',  x: 630, y: 560 },
        { id: 'BL', x:  90, y: 830 }, { id: 'B', x: 360, y: 830 }, { id: 'BR', x: 630, y: 830 },
      ],
      lines: [
        ['TL','T','TR'], ['L','C','R'], ['BL','B','BR'],
        ['TL','L','BL'], ['T','C','B'], ['TR','R','BR'],
        ['TL','C','BR'], ['TR','C','BL'],
      ],
    },
  },
  boardStrokes: [
    // square sides (each side is a straight segment through an edge midpoint)
    { kind: 'segment', from: 'TL', to: 'TR' },
    { kind: 'segment', from: 'BL', to: 'BR' },
    { kind: 'segment', from: 'TL', to: 'BL' },
    { kind: 'segment', from: 'TR', to: 'BR' },
    // inner cross
    { kind: 'segment', from: 'L', to: 'R' },
    { kind: 'segment', from: 'T', to: 'B' },
    // diagonals
    { kind: 'segment', from: 'TL', to: 'BR' },
    { kind: 'segment', from: 'TR', to: 'BL' },
  ],
};
```

`src/game/modes/registry.ts` — add one entry (order = menu order):

```ts
import { MORRIS_MODE } from './morris';
// ...
export const MODES: Record<string, GameModeDef> = {
  [WELL_MODE.id]: WELL_MODE,
  [MORRIS_MODE.id]: MORRIS_MODE,
};
```

All 8 strokes are straight segments — no arcs — so the existing `BoardScene.drawBoard` renders
this mode with zero new render code. `MainMenu.tsx` (which maps over `Object.values(MODES)`)
shows a "Three-in-a-Row" button automatically.

---

## Renderer / Shell Integration

The generic layers already work. The ONLY code touch outside `engine/` and `modes/`:

- **`src/game/scenes/BoardScene.ts` — 1-line guard, REQUIRED for strict compile.** Once `Move`
  gains `pass`, `syncPebbles`'s existing `else` branch reads `move.from` (`BoardScene.ts:332`), which
  does not exist on `{kind:'pass'}` → TS2339 under `strict`. Add an early return for `pass` FIRST so
  the branch type-narrows and a (proven-unreachable) forced pass is a visual no-op:

  ```ts
  private syncPebbles(move: Move) {
    if (move.kind === 'pass') return;   // NEW: nothing visual changes on a pass
    // ...existing place/move handling unchanged...
  }
  ```

- **Optional (Should, defensive):** auto-apply a forced pass so the human is never stuck staring
  at a board with no legal tap. In `applyAndSync` / after a state change, if it is the human's
  turn and `legalMoves(...)` is exactly `[{kind:'pass'}]`, schedule
  `this.applyAndSync({kind:'pass'})` after a short delay. The AI already returns `pass` from
  `chooseMove` when appropriate, so `maybeScheduleAiMove` needs no change. Given the invariant
  (pass is unreachable pre-win), this is safety only.

- **No changes** to `MainMenu.tsx`, `OpponentSelect.tsx`, `Hud.tsx`, `App.tsx`,
  `PhaserGame.tsx`, `theme.ts`. Existing HUD copy already covers this mode:
  "Red: place pebble (n/3)", "Red: move a pebble", "Red wins!", "Draw!". `AI_PLAYER = 2` and the
  human-is-P1 assumption in `BoardScene` apply unchanged.

---

## Engine Test Vectors (all in a new `src/game/engine/__tests__/morris.test.ts` unless noted)

Use a `makeState` helper like the Mode 1 test file, defaulting `modeId:'morris'`,
`placed:{1:3,2:3}`, `phase:'movement'`, `winner:null`, `history:{}`. `CFG = MORRIS_MODE.engine`.

- **A1 board sanity**: `adjacency(CFG.board)` (each list sorted) equals the adjacency table above;
  `C` has 8 neighbours, every other vertex has 3.
- **A2 placement start**: `legalMoves(CFG, initialState(CFG,'morris'))` has length 9, all `place`.
- **A3 win on placement**: from initial, apply places `['TL','BL','T','BR','TR']`
  (P1:TL, P2:BL, P1:T, P2:BR, P1:TR). After the 5th (P1's 3rd), state is `gameover`,
  `winner:1` (top row), `current:2`. Guards the placement-phase alignment check.
- **A4 no premature win**: from initial, apply `['TL','T']` (P1:TL, P2:T) → still `placement`,
  `winner:null`. (A single pebble or two non-aligned pebbles never win.)
- **A5 single-step movement, no sliding**: legal 3/3/3 movement board
  `{TL:2,T:2,TR:1, L:1,C:null,R:null, BL:null,B:1,BR:2}`, `current:1`
  (P1 = `{L,B,TR}`, P2 = `{TL,T,BR}`, empty = `{C,R,BL}`; neither player aligned). The COMPLETE set
  of legal P1 moves is exactly `{L→C, L→BL, B→BL, B→C, TR→R, TR→C}` (6 moves). The decisive assertion
  is **`L→R` is NOT legal**: `L` and `R` share the middle row `L-C-R` with `C` empty and `R` empty,
  so an any-distance *slide* would reach `R` — a single `step` must not (R is two away). Also assert
  every legal `to` is an adjacency-listed neighbour of its `from`. (The earlier draft of this vector
  used an illegal 3/4/2 board — do not reintroduce it.)
- **A6 win on move**: `{TL:1,TR:1,C:1, L:2,R:2,B:2, T:null,BL:null,BR:null}`, `current:1`.
  Apply `{kind:'move', from:'C', to:'T'}` (C adj T, T empty) → top row `TL,T,TR` all P1 →
  `gameover`, `winner:1`, `current:2`. (Verify P2 `{L,R,B}` is not itself a line.)
- **A7 forced pass (synthetic)**: board `{T:1,TR:1,R:1, TL:2,C:2,BR:2, L:null,B:null,BL:null}`,
  `current:1`. P1 pebbles `T,TR,R`: `T` neighbours `TL(2),TR(1),C(2)` all occupied; `TR`
  neighbours `T(1),R(1),C(2)` all occupied; `R` neighbours `TR(1),BR(2),C(2)` all occupied →
  no piece-move → `legalMoves(CFG,s)` equals `[{kind:'pass'}]`. (Board is synthetic for the unit
  only; that P2 sits on a diagonal is irrelevant to a `legalMoves` query.)
- **A8 pass semantics**: applying `{kind:'pass'}` to the A7 state → `phase:'movement'`,
  `current:2`, board unchanged, and `history` gained the new position key. This test only passes
  with BOTH §3 fixes: the legality predicate accepts `pass`, AND the alignment win-check is gated
  off `pass` (`m.kind !== 'pass'`). Without the gate, A7's unchanged board — on which P2 owns the
  main diagonal — would be reported as a P2 win instead of a turn-flip. (A7/A8 exercise a
  proven-unreachable engine path; they are defensive coverage, not a reachable game state.)
- **A9 draw by threefold repetition**: construct a legal movement cycle that returns to the same
  board+side-to-move 3× and assert final `phase:'gameover'`, `winner:null`. (Mirror Mode 1's T8;
  hand-trace a 6-ply oscillation, e.g. two pebbles shuffling through one empty cell and back.)
- **A10 AI takes an immediate win**: give `chooseMoveAlignment` the A6 pre-move state
  (`current:1`, one move from a top-row win) → it returns a move that immediately aligns (e.g.
  `{kind:'move', from:'C', to:'T'}`), and applying it yields `winner:1`.
- **A11 AI blocks an immediate loss**: a movement state where P2 threatens to complete a line
  next turn and P1 (to move, AI) has a move that removes the threat → `chooseMoveAlignment`
  returns a move after which P2 has NO immediate winning move. (Construct a concrete 3-3 board.)
- **A12 Mode 1 untouched**: import `WELL_MODE`; assert `WELL_MODE.engine.win` is `undefined` and
  `WELL_MODE.engine.movement` is `undefined`, and that a spot-check trap vector (reuse T4:
  `E→C` traps blue) still returns `winner:1`. Guards the defaults.

Also required: the ENTIRE existing suite (`rules.test.ts`, `ai.test.ts`, `sanity.test.ts`) must
pass with no edits.

---

## Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `EngineConfig.win`/`movement` seam, defaults reproduce Mode 1 | zero-regression extension |
| Must | Alignment win (placement + movement), single-step movement | the game itself |
| Must | Threefold-repetition draw (reuse) | prevents infinite games |
| Must | `morris` mode data + registry entry (auto menu, auto opponent select) | 2-player + shell |
| Must | Alignment AI (`chooseMoveAlignment`) + `chooseMove` dispatch | vs-AI mode |
| Must | Engine tests A1–A12 + all Mode 1 tests green | correctness + regression safety |
| Should | Forced-pass move + auto-apply in UI | defensive completeness; matches "skip if blocked" |
| Should | Legal-move highlights on select (already generic in BoardScene) | usability (free) |
| Could | AI move-ordering (win-first) | perf only; a board+side transposition table would be UNSOUND (draws are repetition-dependent) — the retrograde solve already avoids it |
| Won't | AI difficulty tiers, online, sound, modes 3+ | v2 scope cut |

### MVP Scope
Phases 1–3 below (engine + mode data/render + AI). Phase 4 (integration polish + playtest) is
thin because the shell is already generic.

### User Flow
Launch → menu (now 2 modes: "Well Board", "Three-in-a-Row") → tap "Three-in-a-Row" → opponent
select (Solo vs AI / Hotseat) → empty 3×3 board, "Red: place pebble (1/3)" → 6 placements
alternating → "Red: move a pebble" → tap own pebble (highlights adjacent empty destinations) →
tap destination (tween) → repeat → someone gets 3 in a row → "Red wins!" overlay →
[Play again] [Menu]. Solo mode: AI (blue, P2) auto-moves after the existing `aiMoveDelayMs`.

---

## Technical Approach

**Feasibility: HIGH.** Additive engine seam pre-authorised by Mode 1's PRD; renderer and shell
already generic; tiny state space makes a near-perfect AI trivial.

**Architecture / new & changed files:**

```
src/game/
  engine/
    types.ts        # +win/movement on EngineConfig, +{kind:'pass'} on Move
    rules.ts        # legalMoves step branch, applyMove alignment+pass, export alignedPlayer
    ai.ts           # +chooseMoveAlignment, chooseMove dispatch on cfg.win
    board.ts        # UNCHANGED (adjacency reused)
    __tests__/morris.test.ts   # NEW (A1–A12)
  modes/
    morris/index.ts # NEW (data only)
    registry.ts     # +1 line
  scenes/
    BoardScene.ts   # +1 line: syncPebbles early-return on 'pass' (+ optional auto-pass)
```

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A default leaks and changes Mode 1 behaviour | M | `win ?? 'trap'`, `movement ?? 'slide'` everywhere; test A12 + full Mode-1 suite must stay green |
| AI first-move latency | L | exact retrograde solve of the 3360-node movement graph (mirrors shipped trap AI), placement minimax on top; memoise `adjacency` — no depth-limited tree explosion |
| `pass` path is proven-unreachable dead code → latent bug | L | synthetic tests A7/A8 cover the engine pass path; `pass` handled in legality + win-gate + `syncPebbles` guard; AI never emits it (aligned nodes excluded from the solve) |
| First-player advantage feels unfair | L | open question; "no centre on move 1" house rule is an isolated future add |
| `Move` union grows a 3rd variant → exhaustiveness gaps | L | TypeScript switch on `kind`; BoardScene/AI handle all three (place/move/pass) |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Engine seam | types (`win`/`movement`/`pass`), `legalMoves` step branch, `applyMove` alignment+pass, `alignedPlayer`, tests A1–A9 + A12 | complete | - | - | `.claude/PRPs/plans/three-in-a-row-phase-1.plan.md` |
| 2 | Mode data + render | `morris/index.ts`, registry entry, `syncPebbles` pass guard; verify board renders + hotseat playable end-to-end | complete (render verified visually; click-through interaction not verified — see report) | with 3 | 1 | - |
| 3 | Alignment AI | alignment-aware `allLiveMovementNodes` filter (shared with trap solver, no separate `chooseMoveAlignment`), tests A10–A11 | complete | with 2 | 1 | - |
| 4 | Integration & playtest | Solo (AI) + Hotseat full playthroughs both outcomes (win/draw), optional auto-pass, HUD copy check, Mode-1 regression sweep | pending (manual click-through playtest still needed) | - | 2, 3 | - |

### Phase Details

**Phase 1: Engine seam** — Goal: correct alignment/step/pass rules, zero rendering. Scope: the
`engine/` edits above + `morris.test.ts` (A1–A9, A12; A10–A11 land in phase 3). Success: `vitest`
green including all Mode 1 tests; no phaser/react import under `engine/`.

**Phase 2: Mode data + render** — Goal: the board looks like the sketch and is playable hotseat.
Scope: `morris/index.ts` data, registry line, `syncPebbles` pass guard. Success: menu shows a 2nd
button; tapping it → 3×3 board renders (square + cross + diagonals); a full hotseat game reaches a
win banner; changing a vertex coord in the data moves the dot (no morris constants in the scene).

**Phase 3: Alignment AI** — Goal: a strong Solo opponent. Scope: `chooseMoveAlignment` + dispatch,
A10/A11. Success: AI takes immediate wins, blocks immediate losses, never loses a drawable game in
10 test games; responds within the existing delay budget.

**Phase 4: Integration & playtest** — Goal: ship-ready. Scope: end-to-end Solo + Hotseat, both a
win and a draw reproduced by hand; optional forced-pass auto-apply; confirm Mode 1 still perfect.
Success: metrics table all green.

### Parallelism Notes
Phases 2 and 3 both depend only on phase 1's engine (data/render needs the types + rules; the AI
needs `legalMoves`/`applyMove`). They touch disjoint files (`modes/` + `scenes/` vs `ai.ts`) and
can run concurrently. Phase 4 is the join.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Win rule | alignment (own 3-in-a-line) | trap | it's the game; user spec |
| Movement | single step to adjacent empty | any-distance slide | user: "along the edges"; classic Three Men's Morris (confirmed) |
| No legal move | pass / skip turn | blocked player loses | user: "skip if blocked" (confirmed); alignment is the only win |
| Centre on move 1 | allowed | forbidden | user confirmed; simplest, matches Mode 1 |
| AI | one strong negamax AI | Easy/Med/Hard tiers | user confirmed; least code, matches existing Solo pattern |
| Draw | threefold repetition (reuse) | move-count cap / none | prevents infinite games; mechanism already built |
| Engine extension | `win`/`movement` discriminators on `EngineConfig` | fork the engine / rule-function hooks | pre-authorised seam in Mode 1 PRD; smallest diff; defaults keep Mode 1 identical |
| `pass` representation | `{kind:'pass'}` in the Move union | empty `legalMoves` + special applyMove | keeps one uniform move pipeline for UI + AI; testable |
| Mode id / name | `morris` / "Three-in-a-Row" | "Tapatan", "Mills" | id stable for tests; display name is an open question |
| Board strokes | 8 straight segments (sharp corners) | arcs for rounded corners | matches the 8 lines exactly; rounded corners are cosmetic; zero render code |

---

## Research Summary

**Market / game context.** Mode 2 is Three Men's Morris / Tapatan / Achi — a traditional 3-in-a-row
game with a placement phase then a movement phase on a 3×3 point board with diagonals. With perfect
play it is a draw, which is why v2 ships a single strong (draw-forcing, never-losing) AI rather than
an "unbeatable" claim, and why a threefold-repetition draw rule is required.

**Technical context (this repo).** Grounding reads: `engine/types.ts` (config seam documented),
`engine/rules.ts` (trap win + slide movement hard-coded in `applyMove`/`legalMoves`), `engine/ai.ts`
(full retrograde trap solver — alignment needs a separate branch), `engine/board.ts`
(`edgesFromLines`/`adjacency` reused for step movement), `scenes/BoardScene.ts` (fully generic over
`GameModeDef`; drives everything through `legalMoves`/`applyMove`/`chooseMove`), `ui/MainMenu.tsx`
(auto-lists `MODES`), `ui/OpponentSelect.tsx` + `App.tsx` (Solo/Hotseat wiring already generic),
`render/theme.ts` (colours/tween reused), `modes/well/index.ts` (the data-only mode pattern to copy).

**Board reference.** User's sketch: square + inner cross + both diagonals = the 9-point Three Men's
Morris board. ASCII normative version in Game Rules. Coordinates reuse Mode 1's 540×540 box so both
boards sit identically in the portrait pillar.

---

*Generated: 2026-07-16*
*Status: REVIEWED — adversarially refuted by 2 agents 2026-07-16. Applied fixes: (1) `pass` legality
arm in `applyMove` (was rejected at runtime + failed strict compile); (2) gate the alignment
win-check off `pass` (else the first pass mis-reports an opponent win — A8 depended on this); (3)
replaced depth-limited negamax with an EXACT retrograde solve mirroring the shipped trap AI (no
horizon blunder; provable optimal play; ~3360-node solve); (4) corrected the illegal A5 board (was
3/4/2) to a legal 3/3/3 position that also asserts `L→R` is not a single step; (5) tie the forced
pass to `win === 'alignment'`, not the `step` branch; (6) `syncPebbles` pass-guard marked
required-for-compile; (7) downgraded "AI never loses" to "plays optimally — never loses a position
that isn't theoretically lost", with the opening value to be computed by the solve and gating the
centre-first decision. SURVIVED unchallenged: adjacency table (independently re-derived), the
pass-unreachability invariant (now PROVEN — immobilisation forces the opponent onto a line through
the centre), placement-win logic, `applyMove` ordering, "Mode 1 defaults unchanged", and the free
menu/opponent/AI integration.*
