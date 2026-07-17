# Plan: Pebble Clash — Phase 2: Engine Types + Pre-placed Init

## Summary

Widen the engine's type surface to admit a jump-capture, elimination-win, pre-placed draughts mode, and teach `initialState` to seed a board from a `preplaced` config and open directly in the `movement` phase. **No game behaviour ships in this phase** — no jump is ever generated or applied. This is the type + state foundation that Phase 3 (rules) builds on.

## User Story

As the implementer of Pebble Clash, I want the engine's `Move` union, `EngineConfig`, and `initialState` to already model jumps, elimination, and pre-placed setups, so that Phase 3 can write the capture rules without simultaneously refactoring types.

## Problem → Solution

`EngineConfig` admits only `movement: slide|step|skip` and `win: trap|alignment`; `Move` has no capture variant; `initialState` always empties the board and opens in `placement`. → `EngineConfig` also admits `movement: 'draughts'`, `win: 'elimination'`, `preplaced`, and `flyingThreshold`; `Move` gains a `jump` variant; `initialState` seeds `preplaced` and opens in `movement`, while modes without `preplaced` behave exactly as before.

## Metadata

- **Complexity**: Small
- **Source PRD**: `.claude/PRPs/prds/pebble-clash.prd.md`
- **PRD Phase**: 2 — "Engine types + pre-placed init"
- **Estimated Files**: 4 (3 UPDATE, 1 CREATE)
- **Depends on**: nothing. Phase 1 (board transcription) is already complete — the geometry lives in the PRD's **Board Geometry** section. **This phase does not need the board data**; it uses a synthetic 3-vertex fixture. Do not transcribe the real 37-vertex board here — that is Phase 5.

---

## UX Design

**N/A — internal change.** No mode is registered in this phase, so nothing reaches the player. `MainMenu` still shows exactly two modes (`well`, `morris`). The one user-visible file touched (`BoardScene.ts`) receives a single unreachable guard clause, not a behaviour change.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `src/game/engine/types.ts` | 1–35 (all) | The exact file you are widening. Note the header comment: `engine/ imports NOTHING outside engine/`. |
| P0 (critical) | `src/game/engine/rules.ts` | 12–26 | `initialState` — the function you are changing. |
| P0 (critical) | `src/game/engine/rules.ts` | 108–117 | `applyMove`'s legality ternary — **breaks on typecheck** when `Move` widens. See Task 3. |
| P0 (critical) | `src/game/scenes/BoardScene.ts` | 305–356 | `syncPebbles` — **breaks on typecheck** when `Move` widens. See Task 4. |
| P1 (important) | `src/game/engine/__tests__/rules.test.ts` | 1–35 | Test conventions: imports, `makeState` helper, `describe('T1 ...')` labelling. |
| P1 (important) | `src/game/engine/__tests__/morris.test.ts` | 1–30 | Second example of the same test conventions (`A1`, `A2` labels). |
| P2 (reference) | `src/game/modes/morris/index.ts` | all | Shape of a `GameModeDef` — for context only; **do not create a mode in this phase**. |
| P2 (reference) | `.claude/PRPs/prds/pebble-clash.prd.md` | "Board Geometry", "Phase Details → Phase 2" | Source of truth for intent. |

## External Documentation

None. No external research needed — this phase uses only established internal patterns.

---

## Patterns to Mirror

### CODE_STYLE
```ts
// SOURCE: src/game/engine/rules.ts:12-26
export function initialState(cfg: EngineConfig, modeId: string): GameState {
    const board: Record<VertexId, PlayerId | null> = {};
    for (const v of cfg.board.vertices) {
        board[v.id] = null;
    }
    return {
        modeId,
        phase: 'placement',
        board,
        current: 1,
        placed: { 1: 0, 2: 0 },
        winner: null,
        history: {}
    };
}
```
4-space indent, single quotes, semicolons, named `export function`.

### COMMENT_STYLE
```ts
// SOURCE: src/game/engine/board.ts:20-22
//  Keyed by board object identity (each mode's board is a single stable
//  const) so the ~3360-node alignment AI solve doesn't rebuild this 9-node
//  graph on every legalMoves call.
```
`//` followed by **two spaces**. Comments explain *why*, not *what*. Match this density — the engine is heavily commented with rationale.

### ERROR_HANDLING
```ts
// SOURCE: src/game/engine/rules.ts:114-116
    if (!legal) {
        throw new Error(`illegal move: ${JSON.stringify(m)}`);
    }
```
Plain `throw new Error` with a template-literal message naming the offending value. No custom error classes, no logging framework anywhere in `engine/`.

### LOGGING_PATTERN
**None.** `engine/` contains no logging of any kind. Do not add any.

### TYPE_DEFINITIONS
```ts
// SOURCE: src/game/engine/types.ts:13-19
export interface EngineConfig {
    board: BoardDef;
    pebblesPerPlayer: number;
    repetitionLimit?: number;
    movement?: 'slide' | 'step' | 'skip';
    win?: 'trap' | 'alignment';
}
```
Optional behaviour switches are string-literal unions with `?`, defaulted at the use site via `??` (e.g. `cfg.movement ?? 'slide'`), never in the type.

```ts
// SOURCE: src/game/engine/types.ts:21-29
export interface GameState {
    modeId: string;
    phase: Phase;
    board: Record<VertexId, PlayerId | null>;
    current: PlayerId;
    placed: Record<PlayerId, number>;
    winner: PlayerId | null;
    history?: Record<string, number>;
}
```
Per-player maps use `Record<PlayerId, T>` — mirror this for `preplaced`.

### TEST_STRUCTURE
```ts
// SOURCE: src/game/engine/__tests__/rules.test.ts:1-20
import { describe, expect, it } from 'vitest';
import { WELL_MODE } from '../../modes/well';
import { adjacency, edgesFromLines } from '../board';
import { applyMove, initialState, legalMoves } from '../rules';
import type { EngineConfig, GameState, Move, PlayerId, VertexId } from '../types';

const CFG = WELL_MODE.engine;

//  PRD fixture note: vectors list decision-relevant fields; helper fills defaults.
function makeState(partial: Partial<GameState> & { board: Record<VertexId, PlayerId | null> }): GameState {
    return {
        modeId: 'well',
        phase: 'movement',
        current: 1,
        placed: { 1: 2, 2: 2 },
        winner: null,
        history: {},
        ...partial
    };
}
```
Tests live in `src/game/engine/__tests__/<topic>.test.ts`. Import `{ describe, expect, it }` from `vitest` (no globals). Config is hoisted to a `const CFG`.

```ts
// SOURCE: src/game/engine/__tests__/rules.test.ts:32-38
describe('T1 board sanity', () => {
    it('derives exactly the 7 well edges, no S-E', () => {
```
`describe` blocks carry a PRD test-vector id prefix (`T1`, `A1`, `A2`). **Use a `C` prefix for clash** (`C1`, `C2`, …).

```ts
// SOURCE: src/game/engine/__tests__/rules.test.ts:30-34
//  Independent reimplementation of the engine's positionKey — deliberately
//  NOT imported from rules.ts, so a bug in the engine's own key function
//  can't hide behind identical test expectations.
```
Note the house style: tests deliberately avoid tautology by re-deriving expectations rather than importing the code under test.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/game/engine/types.ts` | UPDATE | Widen `EngineConfig` + `Move` |
| `src/game/engine/rules.ts` | UPDATE | `initialState` seeds `preplaced`; keep legality ternary exhaustive; guard unimplemented `draughts` |
| `src/game/scenes/BoardScene.ts` | UPDATE | One guard clause — required to keep `tsc` green once `Move` widens |
| `src/game/engine/__tests__/clash.test.ts` | CREATE | Phase 2 test vectors C1–C3 |

## NOT Building

Do not touch any of these — each belongs to a later phase, and doing it here will make the diff unreviewable:

- **Jump legality or application** (`legalMoves` / `applyMove` jump handling) → Phase 3.
- **The `draughts` movement branch** — quiet steps, flying slides, chain enumeration → Phase 3.
- **`win: 'elimination'` win detection** → Phase 3. (Only the *type* lands here.)
- **`pebbleCount` helper** → Phase 3.
- **`aiGreedy.ts` or any AI dispatch** → Phase 4.
- **The real 37-vertex board, `clash/index.ts`, or registry entry** → Phase 5. The board geometry is already resolved in the PRD; do not transcribe it here.
- **Jump rendering, pre-placed pebble seeding in `BoardScene.create()`, landing highlights** → Phase 6.
- Renaming the mode (Q6 open — `clash` stands).

---

## Step-by-Step Tasks

### Task 1: Widen `EngineConfig`

- **ACTION**: Edit `src/game/engine/types.ts`, replacing the `EngineConfig` interface (currently lines 13–19).
- **IMPLEMENT**:
```ts
export interface EngineConfig {
    board: BoardDef;
    pebblesPerPlayer: number;
    repetitionLimit?: number;
    movement?: 'slide' | 'step' | 'skip' | 'draughts';
    win?: 'trap' | 'alignment' | 'elimination';
    //  Pre-seeded pebbles, keyed by player. When present, initialState skips
    //  the placement phase entirely and opens in 'movement'. Every id must
    //  exist in board.vertices and appear at most once across both players.
    preplaced?: Record<PlayerId, VertexId[]>;
    //  A player reduced to this many pebbles or fewer may move long-range
    //  ("flying"). Consulted ONLY by the 'draughts' branch (Phase 3). Default 3.
    flyingThreshold?: number;
}
```
- **MIRROR**: TYPE_DEFINITIONS — optional literal-union switches, `Record<PlayerId, T>` for per-player data.
- **IMPORTS**: none new. `PlayerId` and `VertexId` are already declared at the top of this same file (lines 4–5).
- **GOTCHA**: Do **not** give `flyingThreshold` a default value in the type. The codebase defaults at the use site with `??` (see `cfg.movement ?? 'slide'` at `rules.ts:39`). Phase 3 will write `cfg.flyingThreshold ?? 3`.
- **VALIDATE**: `npm run typecheck` — still green (widening a union with all-optional additions breaks nothing on its own).

### Task 2: Add the `jump` variant to `Move`

- **ACTION**: Edit `src/game/engine/types.ts`, replacing the `Move` union (currently lines 31–34).
- **IMPLEMENT**:
```ts
//  A jump is ONE turn, not one hop: `hops` is the ordered chain the pebble
//  takes. Each hop names the vertex captured (`over`) and the vertex landed
//  on (`to`). The mover leaves `from` and ends on the LAST hop's `to`; every
//  `over` is removed. hops.length >= 1. Chain enumeration lands in Phase 3.
export type Move =
    | { kind: 'place'; to: VertexId }
    | { kind: 'move'; from: VertexId; to: VertexId }
    | { kind: 'jump'; from: VertexId; hops: { over: VertexId; to: VertexId }[] }
    | { kind: 'pass' };
```
- **MIRROR**: COMMENT_STYLE — `//` + two spaces, explaining the *why* (that a jump is a whole turn) rather than restating the fields.
- **IMPORTS**: none new.
- **GOTCHA**: **This task alone breaks `npm run typecheck` in two other files.** That is expected and correct — it is the compiler finding every place that assumed `Move` had only three shapes. Tasks 3 and 4 fix exactly those two sites. Do not revert this task when the errors appear; do not "fix" them by loosening types to `any`.
- **VALIDATE**: `npm run typecheck` now reports errors **only** at `src/game/engine/rules.ts:112` and `src/game/scenes/BoardScene.ts:340,346,347` (`Property 'to' does not exist on type '{ kind: "jump"; ... }'`). If you see errors anywhere else, stop and re-read Task 2.

### Task 3: Keep `applyMove`'s legality check exhaustive

- **ACTION**: Edit `src/game/engine/rules.ts`, replacing the `legal` ternary at lines 109–113.
- **IMPLEMENT**:
```ts
    const legal = legalMoves(cfg, s).some((lm) =>
        lm.kind === 'pass'  ? m.kind === 'pass'
        : lm.kind === 'place' ? (m.kind === 'place' && lm.to === m.to)
        : lm.kind === 'move' ? (m.kind === 'move' && lm.from === m.from && lm.to === m.to)
        //  'jump' is unreachable until Phase 3 teaches legalMoves to emit one;
        //  until then every jump is correctly rejected as illegal.
        : false
    );
```
- **MIRROR**: the existing ternary's exact chained-`:` alignment — this is a deliberate formatting choice in the file, keep it.
- **IMPORTS**: none new.
- **GOTCHA**: The pre-existing code's final branch was an *implicit* "must be a move" (`: (m.kind === 'move' && ...)`). Once `jump` joins the union that branch's `lm` narrows to `move | jump` and `lm.to` no longer type-checks. Adding the explicit `lm.kind === 'move' ?` test is what restores narrowing. Do not delete the `: false` — an unreachable-today branch is what keeps the union exhaustive.
- **VALIDATE**: `npm run typecheck` — the `rules.ts:112` error is gone; `BoardScene.ts` errors remain (Task 4).

### Task 4: Guard `syncPebbles` against the new variant

- **ACTION**: Edit `src/game/scenes/BoardScene.ts`. Find the line `if (move.kind === 'pass') return;` (line 332) inside `syncPebbles`, and insert immediately after it.
- **IMPLEMENT**:
```ts
        if (move.kind === 'pass') return;
        //  Jump rendering — hop-by-hop tween plus destroy() of each captured
        //  pebble — is Phase 6. A jump cannot reach here yet: legalMoves never
        //  emits one, and applyMove rejects it. The guard exists so the Move
        //  union stays exhaustive for tsc below, where `move` must narrow to
        //  the single { kind: 'move' } shape that has both `from` and `to`.
        if (move.kind === 'jump') return;
```
- **MIRROR**: COMMENT_STYLE. Note `BoardScene.ts` uses **Allman braces** (`{` on its own line) unlike `engine/` — but these two guards are single-line `return`s with no braces, so no brace style is involved. Match the surrounding 8-space indentation inside the method.
- **IMPORTS**: none new. `Move` is already imported in this file.
- **GOTCHA**: This is the one place this phase touches outside `engine/`, and it is **not optional** — `move.to` at lines 340/346/347 cannot narrow without it. Note the asymmetry that makes the error confusing: `move.from` at lines 334–335 compiles fine because `jump` *also* has a `from`; only `.to` fails. Do not be tempted to "fix" this by reading `move.hops[...]` here — rendering is Phase 6.
- **VALIDATE**: `npm run typecheck` — **fully green, zero errors**.

### Task 5: Teach `initialState` to seed `preplaced`

- **ACTION**: Edit `src/game/engine/rules.ts`, replacing `initialState` (lines 12–26).
- **IMPLEMENT**:
```ts
export function initialState(cfg: EngineConfig, modeId: string): GameState {
    const board: Record<VertexId, PlayerId | null> = {};
    for (const v of cfg.board.vertices) {
        board[v.id] = null;
    }
    //  Pre-placed modes have no placement phase: seed the board from config
    //  and open in movement. Validated eagerly because a typo'd vertex id in
    //  a mode's transcription is otherwise a silently-missing pebble.
    if (cfg.preplaced) {
        for (const p of [1, 2] as PlayerId[]) {
            for (const id of cfg.preplaced[p]) {
                if (!(id in board)) {
                    throw new Error(`preplaced vertex not on board: ${id}`);
                }
                if (board[id] !== null) {
                    throw new Error(`preplaced vertex occupied twice: ${id}`);
                }
                board[id] = p;
            }
        }
        return {
            modeId,
            phase: 'movement',
            board,
            current: 1,
            placed: { 1: cfg.preplaced[1].length, 2: cfg.preplaced[2].length },
            winner: null,
            history: {}
        };
    }
    return {
        modeId,
        phase: 'placement',
        board,
        current: 1,
        placed: { 1: 0, 2: 0 },
        winner: null,
        history: {}
    };
}
```
- **MIRROR**: CODE_STYLE (the existing `initialState` body is the literal template); ERROR_HANDLING (`throw new Error` with the offending id interpolated).
- **IMPORTS**: none new — `PlayerId` is already imported as a type at `rules.ts:2`.
- **GOTCHA (why `placed` is set, even though placement is skipped)**: `applyMove` recomputes phase with
  `s.phase === 'placement' && placed[1] + placed[2] < 2 * cfg.pebblesPerPlayer ? 'placement' : 'movement'` (`rules.ts:130-133`).
  Because `s.phase` already equals `'movement'`, that expression yields `'movement'` regardless of `placed` — so the game cannot fall back into placement. `placed` is still set to the true seeded counts so the field is never a lie to future readers and to any HUD that displays it. Set it correctly; do not leave it `{ 1: 0, 2: 0 }`.
- **GOTCHA (`[1, 2] as PlayerId[]`)**: the cast is required — TypeScript infers `number[]` from the array literal, which cannot index `Record<PlayerId, VertexId[]>`.
- **VALIDATE**: `npm run typecheck` green; `npm test` — all pre-existing tests still pass, because every existing mode omits `preplaced` and takes the unchanged second `return`.

### Task 6: Fail loudly on the unimplemented `draughts` branch

- **ACTION**: Edit `src/game/engine/rules.ts`. In `legalMoves`, inside the `phase === 'movement'` section, insert **before** the existing `if ((cfg.movement ?? 'slide') === 'skip')` chain (currently line 39).
- **IMPLEMENT**:
```ts
    //  phase === 'movement'
    //  Phase 3 replaces this throw with the real draughts branch (quiet steps,
    //  flying slides, maximal jump chains). It exists because the fall-through
    //  below defaults to 'slide' — without it, a draughts mode registered
    //  before Phase 3 lands would silently play as a slide game rather than
    //  fail, which is far harder to diagnose than a crash.
    if (cfg.movement === 'draughts') {
        throw new Error('draughts movement not implemented until Phase 3');
    }
    let moves: Move[];
```
- **MIRROR**: ERROR_HANDLING.
- **IMPORTS**: none new.
- **GOTCHA**: Because of this throw, **your Phase 2 tests must never call `legalMoves` or `applyMove` on a `draughts` config.** Test `initialState` only — that is this phase's entire behavioural surface. Phase 3's first action is to delete this throw and replace it with the real branch (a natural TDD red).
- **VALIDATE**: `npm test` — no existing test uses `movement: 'draughts'`, so nothing regresses.

### Task 7: Write the Phase 2 test vectors

- **ACTION**: Create `src/game/engine/__tests__/clash.test.ts`.
- **IMPLEMENT**:
```ts
import { describe, expect, it } from 'vitest';
import { MORRIS_MODE } from '../../modes/morris';
import { WELL_MODE } from '../../modes/well';
import { initialState } from '../rules';
import type { EngineConfig } from '../types';

//  Synthetic 3-vertex fixture, NOT the real Pebble Clash board. Phase 2 is
//  proving the preplaced MECHANISM; the real 37-vertex transcription and its
//  16/16 fidelity assertions are Phase 5's job (see the PRD's Board Geometry
//  section). Keeping the fixture tiny means these vectors stay readable and
//  do not silently re-test the board data.
const FIXTURE: EngineConfig = {
    pebblesPerPlayer: 1,
    win: 'elimination',
    preplaced: { 1: ['a'], 2: ['c'] },
    board: {
        vertices: [
            { id: 'a', x: 0, y: 0 },
            { id: 'b', x: 1, y: 0 },
            { id: 'c', x: 2, y: 0 }
        ],
        lines: [['a', 'b', 'c']]
    }
};

const withPreplaced = (preplaced: EngineConfig['preplaced']): EngineConfig => ({
    ...FIXTURE,
    preplaced
});

describe('C1 preplaced seeding', () => {
    it('seeds both players onto the board and leaves the rest empty', () => {
        const s = initialState(FIXTURE, 'clash');
        expect(s.board).toEqual({ a: 1, b: null, c: 2 });
    });

    it('opens in movement phase, skipping placement entirely', () => {
        expect(initialState(FIXTURE, 'clash').phase).toBe('movement');
    });

    it('reports the seeded pebbles as already placed', () => {
        expect(initialState(FIXTURE, 'clash').placed).toEqual({ 1: 1, 2: 1 });
    });

    it('still opens with player 1 to move, no winner, empty history', () => {
        const s = initialState(FIXTURE, 'clash');
        expect(s.current).toBe(1);
        expect(s.winner).toBeNull();
        expect(s.history).toEqual({});
    });
});

describe('C2 preplaced validation', () => {
    it('throws on a vertex id that is not on the board', () => {
        expect(() => initialState(withPreplaced({ 1: ['a'], 2: ['zz'] }), 'clash'))
            .toThrow(/preplaced vertex not on board: zz/);
    });

    it('throws when both players claim the same vertex', () => {
        expect(() => initialState(withPreplaced({ 1: ['a'], 2: ['a'] }), 'clash'))
            .toThrow(/preplaced vertex occupied twice: a/);
    });

    it('throws when one player lists the same vertex twice', () => {
        expect(() => initialState(withPreplaced({ 1: ['a', 'a'], 2: ['c'] }), 'clash'))
            .toThrow(/preplaced vertex occupied twice: a/);
    });
});

describe('C3 no regression for placement modes', () => {
    it.each([
        ['well', WELL_MODE],
        ['morris', MORRIS_MODE]
    ])('%s still starts in placement on an empty board', (id, mode) => {
        const s = initialState(mode.engine, id);
        expect(s.phase).toBe('placement');
        expect(s.placed).toEqual({ 1: 0, 2: 0 });
        expect(Object.values(s.board).every((v) => v === null)).toBe(true);
    });
});
```
- **MIRROR**: TEST_STRUCTURE — `vitest` named imports, `const` config hoisted, `C`-prefixed `describe` ids, the fixture-note comment convention from `rules.test.ts:10`.
- **IMPORTS**: exactly as written above.
- **GOTCHA**: Do **not** import or call `legalMoves`/`applyMove` in this file — Task 6's guard throws on `draughts`, and in any case no movement behaviour exists yet. Note the fixture deliberately omits `movement`, so it would default to `'slide'` if anything did call it.
- **VALIDATE**: `npm test` — 10 new assertions pass, zero existing tests fail.

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| C1 seeding | `FIXTURE` (`preplaced {1:['a'],2:['c']}`) | `board = { a:1, b:null, c:2 }` | no |
| C1 phase | `FIXTURE` | `phase === 'movement'` | no |
| C1 placed | `FIXTURE` | `placed === { 1:1, 2:1 }` | no |
| C1 defaults | `FIXTURE` | `current=1`, `winner=null`, `history={}` | no |
| C2 unknown id | `preplaced {2:['zz']}` | throws `/not on board: zz/` | **yes** |
| C2 cross-player collision | `preplaced {1:['a'],2:['a']}` | throws `/occupied twice: a/` | **yes** |
| C2 self collision | `preplaced {1:['a','a']}` | throws `/occupied twice: a/` | **yes** |
| C3 regression | `WELL_MODE.engine`, `MORRIS_MODE.engine` | `phase='placement'`, all vertices null | **yes** |

### Edge Cases Checklist

- [x] **Empty input** — a mode with no `preplaced` key takes the original path (C3).
- [x] **Invalid ids** — vertex not on board throws (C2).
- [x] **Duplicate ids** — same vertex twice, within *and* across players, throws (C2).
- [x] **Union exhaustiveness** — `jump` reaching `applyMove` (rejected as illegal, Task 3) and `syncPebbles` (early return, Task 4).
- [x] **Unimplemented branch** — `movement: 'draughts'` throws rather than silently sliding (Task 6).
- [ ] Concurrent access — N/A, engine is pure and synchronous.
- [ ] Network failure — N/A.
- [ ] Permission denied — N/A.

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: zero errors. **Mid-implementation this will fail after Task 2 and stay failing until Task 4** — that is the designed sequence, not a defect.

### Full Test Suite
```bash
npm test
```
EXPECT: all pre-existing suites (`rules.test.ts`, `morris.test.ts`, `ai.test.ts`, `sanity.test.ts`) still green, plus the new `clash.test.ts`. **Zero regressions is the headline signal of this phase** — every existing mode must be provably untouched.

### Browser Validation
Not required for this phase — no registered mode changes. If you want a smoke check:
```bash
npm run dev
```
EXPECT: menu still lists exactly "Pebble Trap" and "Three-in-a-Row"; both still playable start to finish. No "Pebble Clash" entry yet (that is Phase 5).

### Manual Validation
- [ ] `git diff --stat` shows exactly 4 files, and **no file under `src/game/modes/`**.
- [ ] `src/game/engine/types.ts` still imports nothing (the file's header rule: `engine/ imports NOTHING outside engine/`).
- [ ] The `BoardScene.ts` diff is exactly one guard clause plus its comment.

---

## Acceptance Criteria

- [ ] `EngineConfig` admits `movement: 'draughts'`, `win: 'elimination'`, `preplaced`, `flyingThreshold`.
- [ ] `Move` admits the `jump` variant with the exact shape in Task 2.
- [ ] `initialState(cfgWithPreplaced)` seeds the board and returns `phase: 'movement'` with correct `placed`.
- [ ] `initialState` throws on unknown or doubly-claimed preplaced ids.
- [ ] `well` and `morris` still start in `placement` on an empty board.
- [ ] `npm run typecheck` green.
- [ ] `npm test` green, no regressions.

## Completion Checklist

- [ ] Code follows discovered patterns (4-space, single quotes, `//  ` comments with rationale)
- [ ] Error handling matches codebase style (`throw new Error` with interpolated id)
- [ ] No logging added to `engine/`
- [ ] Tests follow `__tests__/*.test.ts` + `describe('C<n> ...')` convention
- [ ] No hardcoded board data (the real board is Phase 5)
- [ ] No unnecessary scope additions — see **NOT Building**
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Implementer reverts Task 2 when typecheck goes red, instead of proceeding to Tasks 3–4 | **H** | Phase stalls | Task 2's GOTCHA states the errors are expected and names the exact two files + line numbers |
| Implementer "fixes" the `BoardScene` error by writing jump rendering | M | Phase 6 scope leaks in | Task 4 GOTCHA + **NOT Building** both forbid it; the guard is a one-line `return` |
| A `draughts` mode registered before Phase 3 silently plays as slide | M | Confusing wrong behaviour | Task 6 converts it to a loud throw |
| Implementer transcribes the real 37-vertex board into this phase | M | Duplicates Phase 5, bloats diff | Metadata + NOT Building + Task 7 GOTCHA all state the fixture is synthetic and deliberate |
| `placed` left `{1:0,2:0}` for preplaced modes | L | Latent lie; harmless today, wrong for any HUD | Task 5 GOTCHA explains why it's set and why phase can't regress |

## Notes

**Deviation from the PRD, deliberate.** The PRD's Phase 2 success signal reads: *"a test shows `initialState(clashCfg)` yields 16/16 pebbles, `phase: 'movement'`"*. That is not achievable in Phase 2 without the real board, which is Phase 5's deliverable — the PRD's own dependency graph puts the mode def after this. This plan therefore splits the signal:
- **Phase 2 (here)**: the `preplaced` *mechanism*, proven on a synthetic 3-vertex fixture.
- **Phase 5**: the 16/16/centre-empty *fidelity* assertion against the real transcription. The PRD's Phase 5 row and Phase 1 detail have already been updated to carry that test.

**Free win for Phase 3, noted here so it isn't re-derived.** `applyMove`'s existing trap check (`rules.ts:160`) reads
`if ((cfg.win ?? 'trap') !== 'alignment' && legalMoves(cfg, next).length === 0)`.
Since `'elimination' !== 'alignment'`, this fires unchanged for clash and already awards the win to the previous mover when the next player has no legal move — i.e. **PRD open question Q5 (loss by no-move) is satisfied for free**, no new code. Phase 3 must verify this with a test rather than reimplement it, and must be careful that its elimination check runs *before* this block for the case where the opponent has zero pebbles (zero pebbles also means zero legal moves, so both conditions fire on the same move and the elimination path must own the semantics — they happen to agree on the winner here, but relying on that coincidence is fragile).

**Q6 (mode name) remains open.** This phase hardcodes no mode id, so a later rename costs nothing here.
