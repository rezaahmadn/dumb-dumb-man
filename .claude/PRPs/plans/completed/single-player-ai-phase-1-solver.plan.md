# Plan: Single-Player AI — Phase 1 (Solver + Tests)

## Summary
Adds a pure, engine-adjacent solver module (`src/game/engine/ai.ts`) that picks optimal moves for Pebble Trap via exact game-graph solving — retrograde/fixpoint labeling for the finite movement-phase graph, plain recursive negamax for the acyclic placement phase. No engine files change. Headless only — no UI wiring (that's Phase 2).

## User Story
As the future caller of this module (`BoardScene`, in Phase 2), I want a `chooseMove(cfg, state): Move` function that always returns a legal, game-theoretically optimal move, so a solo player can eventually play a full game against a correct, non-cheating bot.

## Problem → Solution
No AI exists; hotseat is the only way to play. → A pure solver reusing the existing `legalMoves`/`applyMove` engine functions computes optimal moves, verified by an exhaustive test suite, ready for Phase 2 to wire into the UI.

## Metadata
- **Complexity**: Medium (2 new files, ~200-300 lines, one moderately novel concept — retrograde graph-game solving — built entirely on existing pure primitives, no new dependencies)
- **Source PRD**: `.claude/PRPs/prds/single-player-ai.prd.md`
- **PRD Phase**: 1 — "AI solver + tests"
- **Estimated Files**: 2 (both new)

---

## UX Design
N/A — internal/headless change. No UI, no rendering, no BoardScene/App.tsx changes in this phase (that's Phase 2). Nothing a user can see or interact with yet.

---

## Mandatory Reading

Files that MUST be read before implementing:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/game/engine/rules.ts` | 1-122 | The ONLY transition/enumeration functions the solver may call (`legalMoves`, `applyMove`, `initialState`). Study the `positionKey`/history/trap-check logic (lines 55-119) closely — the solver's own key function and its understanding of when `applyMove` can return `gameover` depend on this exactly. |
| P0 | `src/game/engine/types.ts` | 1-32 | `GameState`, `EngineConfig`, `Move`, `PlayerId`, `VertexId` shapes. Note line 1's import-boundary comment — `ai.ts` must obey the same rule (imports nothing outside `engine/`). |
| P0 | `.claude/PRPs/prds/single-player-ai.prd.md` | Rules (NORMATIVE) section, Decisions Log, status footer | This is the normative spec for what you're building. The status footer documents an adversarial review that already caught and corrected a serious bug (naive DFS-as-draw is wrong) — the algorithm below reflects the corrected design; do not reintroduce the DFS version. |
| P1 | `src/game/engine/__tests__/rules.test.ts` | 1-35, 183-275 | Test file conventions: imports, `CFG = WELL_MODE.engine`, the `keyOf` independent-reimplementation pattern (lines 34-35) you will mirror in `ai.ts`, and T8-T12 (draw/repetition tests) for how `history`/`repetitionLimit` actually behave in practice. |
| P1 | `src/game/modes/well/index.ts` | 1-32 | The only shipped `EngineConfig` (`WELL_MODE.engine`) — 5 vertices, `pebblesPerPlayer: 2`, `repetitionLimit: 3`. Your combinatorial enumeration (Task 1) must be generic over `cfg`, not hardcoded to these numbers, but it's useful to know what you're testing against. |
| P2 | `src/game/engine/board.ts` | 1-29 | `adjacency`/`edgesFromLines` — not required by the solver, but shows the existing style for small pure graph utilities in this codebase (plain functions, `Record`/`Set`-based, no classes). |
| P2 | `.claude/PRPs/prds/draw-by-repetition.prd.md` | 1-20, 65-127 | Proves the movement-phase state space is exactly 60 positions and that any infinite line is forced to a real draw within ~120 plies. Background for *why* the graph is small enough to solve exactly — not needed to write code, just to trust the approach. |

## External Documentation
No external research needed — feature uses established internal patterns plus a well-understood, standard CS technique (retrograde analysis / backward induction for solving finite two-player game graphs with draw-cycles — the same family of technique used by chess endgame tablebases). No new npm dependencies.

---

## Patterns to Mirror

### MODULE_BOUNDARY
// SOURCE: src/game/engine/types.ts:1
```ts
//  engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/).
```
`ai.ts` lives in `src/game/engine/` and must obey this too: import ONLY from `./types` and `./rules` in this repo. Add the same style of boundary comment at the top of the new file.

### NAMING/STYLE
// SOURCE: src/game/engine/rules.ts:1-19
```ts
import type { EngineConfig, GameState, Move, PlayerId, VertexId } from './types';

export function initialState(cfg: EngineConfig, modeId: string): GameState {
```
4-space indentation, single quotes, semicolons, explicit return types on every exported function, `type`-only imports for types. camelCase functions, PascalCase types. Mirror exactly.

### INDEPENDENT_REIMPLEMENTATION (position key)
// SOURCE: src/game/engine/__tests__/rules.test.ts:31-35
```ts
//  Independent reimplementation of the engine's positionKey — deliberately
//  NOT imported from rules.ts, so a bug in the engine's own key function
//  can't hide behind identical test expectations.
const keyOf = (s: GameState) =>
    CFG.board.vertices.map((v) => s.board[v.id] ?? '.').join('') + '|' + s.current;
```
`rules.ts`'s own `positionKey` (rules.ts:58-60) is NOT exported, and the PRD's Decisions Log explicitly chose to leave `types.ts`/`rules.ts` untouched. Mirror this exact established pattern: `ai.ts` defines and exports its OWN `positionKey`, textually identical logic, not imported from `rules.ts`.

### TERMINAL-STATE CHECK (never hand-roll trap/draw logic)
// SOURCE: src/game/engine/rules.ts:97-119
```ts
if (next.phase === 'movement') {
    ...
    if (legalMoves(cfg, next).length === 0) {
        return { ...next, phase: 'gameover', winner: s.current };
    }
    if (cfg.repetitionLimit !== undefined && repeatCount >= cfg.repetitionLimit) {
        return { ...next, phase: 'gameover', winner: null };
    }
}
```
The solver NEVER reimplements this logic — it only ever reads `applyMove`'s returned `.phase`/`.winner`. This is why `ai.ts` calling `applyMove` is safe and inherits T7/T8/T9's correctness for free.

### TEST_STRUCTURE
// SOURCE: src/game/engine/__tests__/rules.test.ts:1-20, 37-42
```ts
import { describe, expect, it } from 'vitest';
import { WELL_MODE } from '../../modes/well';
import { applyMove, initialState, legalMoves } from '../rules';
import type { EngineConfig, GameState, Move, PlayerId, VertexId } from '../types';

const CFG = WELL_MODE.engine;

describe('T1 board sanity', () => {
    it('derives exactly the 7 well edges, no S-E', () => {
        ...
    });
});
```
`describe`/`it` blocks named `T<n> <description>`, flat top-level `CFG` constant, Vitest only (no mocking framework — everything here is pure functions on plain data).

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/game/engine/ai.ts` | CREATE | The solver module — `chooseMove`, `solveMovementGraph`, `positionKey`, internal helpers |
| `src/game/engine/__tests__/ai.test.ts` | CREATE | Legality, solved-graph invariant, self-play draw, determinism tests |

## NOT Building
- Any change to `src/game/engine/rules.ts` or `types.ts` — zero engine changes (PRD Decisions Log)
- Mode-select UI, `BoardScene` wiring, `App.tsx` changes, HUD "vs AI" indicator — all Phase 2
- Difficulty levels, weakened play, color choice, undo — out of v1 scope entirely (PRD "What We're NOT Building")
- Any caching/memoization of `solveMovementGraph` across calls — recompute fresh every `chooseMove` call; the graph is ≤60 nodes, this is trivially cheap, and caching would add state/invalidation complexity not justified at this size

---

## Step-by-Step Tasks

### Task 1: Position key + combinatorial node enumeration
- **ACTION**: Create `src/game/engine/ai.ts`. Add the module boundary comment (mirror `types.ts:1`). Implement `positionKey(cfg, s)`, a generic `kCombinations<T>(items, k)` helper, and `allLiveMovementNodes(cfg): GameState[]`.
- **IMPLEMENT**:
  ```ts
  export function positionKey(cfg: EngineConfig, s: GameState): string {
      return cfg.board.vertices.map((v) => s.board[v.id] ?? '.').join('') + '|' + s.current;
  }

  function kCombinations<T>(items: T[], k: number): T[][] {
      if (k === 0) return [[]];
      if (items.length < k) return [];
      const [first, ...rest] = items;
      const withFirst = kCombinations(rest, k - 1).map((c) => [first, ...c]);
      const withoutFirst = kCombinations(rest, k);
      return [...withFirst, ...withoutFirst];
  }

  function allLiveMovementNodes(cfg: EngineConfig): GameState[] {
      const vertices = cfg.board.vertices.map((v) => v.id);
      const k = cfg.pebblesPerPlayer;
      const nodes: GameState[] = [];
      for (const p1 of kCombinations(vertices, k)) {
          const rest = vertices.filter((v) => !p1.includes(v));
          for (const p2 of kCombinations(rest, k)) {
              const board: Record<VertexId, PlayerId | null> = {};
              for (const v of vertices) board[v] = null;
              for (const v of p1) board[v] = 1;
              for (const v of p2) board[v] = 2;
              for (const current of [1, 2] as PlayerId[]) {
                  const state: GameState = {
                      modeId: '',
                      phase: 'movement',
                      board,
                      current,
                      placed: { 1: k, 2: k },
                      winner: null,
                      history: {}
                  };
                  if (legalMoves(cfg, state).length > 0) nodes.push(state);
              }
          }
      }
      return nodes;
  }
  ```
- **MIRROR**: INDEPENDENT_REIMPLEMENTATION pattern above for `positionKey`; NAMING/STYLE for everything else.
- **IMPORTS**: `import { applyMove, legalMoves } from './rules';` and `import type { EngineConfig, GameState, Move, PlayerId, VertexId } from './types';` (both used across the whole file — add `applyMove` now even though this task doesn't call it yet, Task 2 will).
- **GOTCHA**: For `well` mode this enumerates exactly `C(5,2) × C(3,2) × 2 = 10 × 3 × 2 = 60` layouts total, of which some are filtered out by the `legalMoves(...).length > 0` check (the trapped ones) — expect 56 to survive for well mode specifically (verified by adversarial review's independent solve; Task 5 asserts this exact count). This formula is generic — it does NOT assume 5 vertices or 2 pebbles anywhere in the code, only in what well mode happens to produce.
- **VALIDATE**: Not independently testable yet (no exported entry point does anything visible) — validated transitively by Task 5's node-count assertion.

### Task 2: Movement-phase graph solve (retrograde/fixpoint labeling)
- **ACTION**: Add `Label`/`Score` types, `scoreOfLabel`, and `solveMovementGraph(cfg): Map<string, Label>` to `ai.ts`.
- **IMPLEMENT**:
  ```ts
  export type Label = 'WIN' | 'LOSS' | 'DRAW';
  export type Score = 1 | 0 | -1;

  const scoreOfLabel = (l: Label): Score => (l === 'WIN' ? 1 : l === 'LOSS' ? -1 : 0);
  const negate = (s: Score): Score => (-s as Score);

  export function solveMovementGraph(cfg: EngineConfig): Map<string, Label> {
      const nodes = allLiveMovementNodes(cfg);
      const byKey = new Map(nodes.map((n) => [positionKey(cfg, n), n]));

      //  One-ply outcome per legal move from each node: either an immediate
      //  win (applyMove returned gameover) or a transition to another live
      //  node. Nodes are synthetic (history:{}), and a single hop off an
      //  empty history can never reach cfg.repetitionLimit (needs >=3
      //  recorded occurrences) — so `gameover` here is always a real trap,
      //  never a repetition draw. See PRD "Search-time history".
      const edges = new Map<string, { win: boolean; to?: string }[]>();
      for (const [key, node] of byKey) {
          edges.set(
              key,
              legalMoves(cfg, node).map((m) => {
                  const child = applyMove(cfg, node, m);
                  return child.phase === 'gameover'
                      ? { win: true }
                      : { win: false, to: positionKey(cfg, child) };
              })
          );
      }

      //  Retrograde/fixpoint labeling — NOT on-stack-DFS-as-draw (see PRD
      //  status footer: that approach is provably incorrect in general and
      //  was replaced after adversarial review).
      const labels = new Map<string, Label>();
      let changed = true;
      while (changed) {
          changed = false;
          for (const key of byKey.keys()) {
              if (labels.has(key)) continue;
              const outs = edges.get(key)!;
              if (outs.some((o) => o.win || (o.to !== undefined && labels.get(o.to) === 'LOSS'))) {
                  labels.set(key, 'WIN');
                  changed = true;
              } else if (outs.every((o) => !o.win && o.to !== undefined && labels.get(o.to) === 'WIN')) {
                  labels.set(key, 'LOSS');
                  changed = true;
              }
          }
      }
      for (const key of byKey.keys()) {
          if (!labels.has(key)) labels.set(key, 'DRAW');
      }
      return labels;
  }
  ```
- **MIRROR**: NAMING/STYLE; TERMINAL-STATE CHECK (the `child.phase === 'gameover'` branch is the ONLY way this code learns about wins — never reimplement trap detection).
- **IMPORTS**: none new (uses `applyMove`/`legalMoves` already imported in Task 1).
- **GOTCHA**: This is the exact algorithm the PRD's adversarial review validated as correct (fixpoint, not on-stack DFS). Do not "optimize" this into a single DFS pass with in-progress-node tracking — that is the specific bug the review found and corrected. The `while (changed)` loop is O(nodes²) worst case, which for ≤60 nodes is trivial; do not add a priority queue or other complexity.
- **VALIDATE**: Task 5's `T-AI-graph` test asserts the exact label distribution for well mode.

### Task 3: Placement-phase negamax (acyclic, leaves into the movement solve)
- **ACTION**: Add `valueOfMove` and `valuePlacement` to `ai.ts`.
- **IMPLEMENT**:
  ```ts
  function valueOfMove(
      cfg: EngineConfig,
      s: GameState,
      m: Move,
      movementLabels: Map<string, Label>
  ): Score {
      const child = applyMove(cfg, s, m);
      if (child.phase === 'gameover') {
          //  A move can only end the game as an immediate WIN for the mover
          //  or a DRAW — applyMove's trap check fires because the OPPONENT
          //  (next to move) has 0 legal moves, so the mover just trapped
          //  them; it can never make the opponent win on your own move.
          return child.winner === s.current ? 1 : 0;
      }
      if (child.phase === 'movement') {
          return negate(scoreOfLabel(movementLabels.get(positionKey(cfg, child))!));
      }
      //  child.phase === 'placement' — still placing, recurse
      return negate(valuePlacement(cfg, child, movementLabels));
  }

  function valuePlacement(cfg: EngineConfig, s: GameState, movementLabels: Map<string, Label>): Score {
      const scores = legalMoves(cfg, s).map((m) => valueOfMove(cfg, s, m, movementLabels));
      return Math.max(...scores) as Score;
  }
  ```
- **MIRROR**: NAMING/STYLE.
- **IMPORTS**: none new.
- **GOTCHA**: `valueOfMove` is deliberately phase-agnostic at the call site — it works whether `s` is a placement or movement state, because it dispatches on the CHILD's phase, not `s`'s. This is why Task 4's `chooseMove` doesn't need its own placement/movement branch. Do not add one. Also note: a `movement`-phase child returned by `applyMove` (i.e. NOT gameover) is guaranteed by construction to be a "live" node (`applyMove`'s own trap check already ruled out 0-legal-move successors) — so `movementLabels.get(...)` is guaranteed to find an entry; the `!` non-null assertion is safe, not a shortcut around a real gap.
- **VALIDATE**: Exercised indirectly by Task 4/5 — `valuePlacement`/`valueOfMove` are not exported (internal only).

### Task 4: `chooseMove` — the public API
- **ACTION**: Add the exported `chooseMove` function, the only symbol Phase 2 will import.
- **IMPLEMENT**:
  ```ts
  export function chooseMove(cfg: EngineConfig, s: GameState): Move {
      const movementLabels = solveMovementGraph(cfg);
      const moves = legalMoves(cfg, s);
      let best = moves[0];
      let bestScore: Score = -1;
      for (const m of moves) {
          const v = valueOfMove(cfg, s, m, movementLabels);
          if (v > bestScore) {
              bestScore = v;
              best = m;
          }
      }
      return best;
  }
  ```
- **MIRROR**: NAMING/STYLE.
- **IMPORTS**: none new.
- **GOTCHA**: Uses `s` exactly as passed by the caller (including its REAL `history`, if any) for this top-level `applyMove` call inside `valueOfMove` — do NOT sanitize history here. This one-ply evaluation is meant to detect a REAL, currently-live repetition-draw if the candidate move would actually trigger one right now; the deeper `solveMovementGraph` table is history-agnostic by design and correctly treats "achievable as at least a draw" the same way regardless of real repeat counts (see PRD "Search-time history"). Tie-break is naturally array-order-first-max via the strict `>` comparison — do not change to `>=`. `chooseMove` assumes `moves.length > 0` (the engine's no-pass rule guarantees this whenever it's actually someone's turn — `s.phase` is not `'gameover'`); it is the caller's responsibility (Phase 2) to never call this on a gameover state, matching how `BoardScene` already gates all input on `phase !== 'gameover'`.
- **VALIDATE**: `npx vitest run src/game/engine/__tests__/ai.test.ts`

### Task 5: Tests
- **ACTION**: Create `src/game/engine/__tests__/ai.test.ts`.
- **IMPLEMENT**: Five test groups (exact assertions below). Reuse `WELL_MODE.engine` as `CFG`, `initialState`/`legalMoves`/`applyMove` from `../rules`, `chooseMove`/`solveMovementGraph` from `../ai`.

  1. **`T-AI1 solved movement graph`**: `solveMovementGraph(CFG)` has `.size === 56`; tallying `[...labels.values()]` by label gives exactly `{ WIN: 8, LOSS: 0, DRAW: 48 }`.
  2. **`T-AI2 chooseMove always returns a legal move`**: drive one full self-play game (see #3's loop) and assert, at every ply, `legalMoves(CFG, s).some(lm => sameMove(lm, chosen))` before applying it — a move is "the same" per the existing engine's own equality shape (`kind`+`to`, or `kind`+`from`+`to`).
  3. **`T-AI3 self-play always ends in a draw`**: starting from `initialState(CFG, 'well')`, loop calling `chooseMove(CFG, s)` then `applyMove(CFG, s, chosen)` to advance `s` (both players use `chooseMove` — it does not know or care which "side" is asking), for up to 200 iterations; assert the loop reaches `phase === 'gameover'` before the iteration cap, and that the final `winner === null`. This is a direct behavioral consequence of the opening position being a proven DRAW (PRD Open Questions) plus both sides playing optimally — perfect-vs-perfect play always realizes the root's true game value.
  4. **`T-AI4 deterministic`**: call `chooseMove(CFG, s)` twice on two separately-constructed-but-deep-equal `GameState` objects for the same fixture (e.g. `initialState(CFG,'well')` called twice); assert the two returned moves are deep-equal. No `Math.random()`/`Date.now()` anywhere in `ai.ts` — grep-checkable.
  5. **Regression**: run the full suite (`npx vitest run`) and confirm all of `rules.test.ts` (T1-T12 + sanity) is unaffected — expected, since no file outside `ai.ts`/`ai.test.ts` is touched.

- **MIRROR**: TEST_STRUCTURE pattern above.
- **IMPORTS**: `import { describe, expect, it } from 'vitest'; import { WELL_MODE } from '../../modes/well'; import { applyMove, initialState, legalMoves } from '../rules'; import { chooseMove, solveMovementGraph } from '../ai'; import type { GameState, Move } from '../types';`
- **GOTCHA**: Do NOT hand-craft a test asserting `chooseMove` returns one *specific* named move for a hand-picked fixture (e.g. "must return E→C") unless you have mechanically verified — by running the code, not by hand-tracing — that it is the uniquely optimal choice. During planning, tracing a superficially "obvious" one-move-from-a-trap fixture (`rules.test.ts`'s T4 board) surfaced that the position actually has TWO legal moves, and the non-obvious one's true value requires multi-ply lookup to know — exactly the kind of thing this solver exists to get right and a human/planning-time trace can get wrong. Prefer the structural assertions above (graph invariant + self-play outcome), which are robust without needing to trust a hand trace.
- **VALIDATE**: `npx vitest run` — all tests green, including new ones; `npm run typecheck` — zero errors.

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| T-AI1 | `WELL_MODE.engine` | label map size 56, `{WIN:8,LOSS:0,DRAW:48}` | structural invariant |
| T-AI2 | every state visited during one self-play game | chosen move ∈ `legalMoves` at each ply | legality under real play, not just synthetic nodes |
| T-AI3 | `initialState(CFG,'well')`, both sides via `chooseMove` | terminates ≤200 plies, `winner === null` | draw-forcing / non-termination |
| T-AI4 | two equal fixtures | identical returned move | determinism / no randomness |
| Regression | n/a | existing 22 tests still pass | no accidental engine coupling |

### Edge Cases Checklist
- [x] Empty board / opening position — covered by T-AI3 (starts here)
- [x] Position one move from a trap — covered structurally by T-AI1 (all 8 WIN nodes), not by a hand-picked fixture (see Task 5 GOTCHA)
- [x] Movement-phase cycle (both sides shuffling) — covered by T-AI3's bounded-iteration assertion; a non-terminating solver would time out the test
- [x] Placement phase ending in an immediate trap (the T7 scenario) — exercised naturally by T-AI3's self-play walk since placement always precedes movement; not separately hand-fixtured, for the same reason as above
- [ ] Concurrent access — N/A, pure synchronous functions, no shared mutable state
- [ ] Network failure — N/A, no I/O

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: Zero type errors.

### Unit Tests
```bash
npx vitest run src/game/engine/__tests__/ai.test.ts
```
EXPECT: All new tests pass.

### Full Test Suite
```bash
npm test
```
EXPECT: All tests pass — the existing 22 (T1-T12 + sanity) plus the new `ai.test.ts` tests, no regressions.

### Browser Validation
N/A this phase — headless only, nothing to see in the browser yet (Phase 2 covers this).

### Manual Validation
- [ ] `npm run typecheck` — clean
- [ ] `npm test` — all green
- [ ] Quick sanity in a scratch script or test: `chooseMove(WELL_MODE.engine, initialState(WELL_MODE.engine, 'well'))` returns one of the 5 opening placement moves without throwing

---

## Acceptance Criteria
- [ ] All 5 tasks completed
- [ ] All validation commands pass
- [ ] Tests written and passing (T-AI1 through T-AI4 + regression)
- [ ] No type errors
- [ ] No lint errors
- [ ] `ai.ts` has zero imports outside `./types` and `./rules` (verify: `grep -n "^import" src/game/engine/ai.ts`)

## Completion Checklist
- [ ] Code follows discovered patterns (module boundary, naming/style, independent-reimplementation, terminal-state-check-via-applyMove-only)
- [ ] No error handling added beyond what `applyMove` already throws (illegal moves) — `chooseMove` does not need its own try/catch; it only ever calls `applyMove` with moves drawn from `legalMoves`, which are legal by construction
- [ ] Tests follow `rules.test.ts`'s `describe`/`it` + `T<n>` naming convention
- [ ] No hardcoded well-mode numbers (5 vertices, 2 pebbles) baked into `ai.ts`'s logic — only into `ai.test.ts`'s assertions, where they're testing well mode specifically
- [ ] No unnecessary scope additions — no caching layer, no difficulty parameter, no UI code
- [ ] Self-contained — no questions needed during implementation (algorithm, types, and tests are fully specified above)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Implementer reintroduces the on-stack-DFS-as-draw approach (looks simpler than fixpoint at first glance) | L — this plan spells out the fixpoint code verbatim | High — silently wrong on any future mode with a forced-loss position, though correct-by-luck for well mode | Task 2's IMPLEMENT block is copy-pasteable; GOTCHA explicitly names the rejected approach |
| `Math.max(...scores)` in `valuePlacement` called with an empty array (`-Infinity`, wrong type) | L — provably can't happen while `s.phase === 'placement'` for well mode (always ≥1 empty vertex until the transition) | Medium if it ever fires | Documented in Task 3 GOTCHA area / Files-to-Change note; not defensively coded against since it can't occur for the only shipped mode, consistent with not adding unneeded validation |
| TS complains about `-Score` not narrowing back to the `1\|0\|-1` union | H — will definitely happen without the cast | Low, compile-time only | `negate()` helper in Task 2 with an explicit `as Score` cast, used everywhere negation is needed |
| A future contributor adds a second mode with a forced-LOSS position and doesn't realize the fixpoint algorithm (not DFS) is load-bearing for correctness there | L for now (no second mode exists yet) | High if it happens | Already mitigated by choosing fixpoint (unconditionally correct) instead of the fragile DFS approach — this risk is why that choice was made |

## Notes
- This phase is intentionally headless/pure — resist any temptation to peek at `BoardScene.ts`/`App.tsx` integration concerns while implementing; that's fully deferred to Phase 2 per the PRD.
- The PRD's Open Question about fastest-win/slowest-loss tie-breaking (a "Should") is explicitly OUT of this phase's task list — `chooseMove`'s tie-break is array-order only, per Task 4. If picked up later, it requires retrograde BFS distance layering (see PRD), not DFS depth — flagged there for a future phase, not solved here.
- After this plan is implemented and its validation commands pass, update the PRD's Phase 1 row from `pending`/`in-progress` to `complete` and link this plan + a completion report, mirroring how `draw-by-repetition.prd.md`'s phase table was closed out.
