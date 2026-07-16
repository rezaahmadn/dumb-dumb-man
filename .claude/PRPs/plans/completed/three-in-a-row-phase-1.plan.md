# Plan: Phase 1 — Engine Seam (Alignment + Step Movement + Pass)

## Summary
Extend the pure game engine with optional `win` and `movement` discriminators so Mode 2 (Three-in-a-Row alignment) works alongside Mode 1 (Well Board trap). Add support for single-step movement, alignment win detection, and forced-pass moves. Zero rendering changes; all edits stay in `src/game/engine/`.

## User Story
As a game engine, I want to support both trap-win and alignment-win modes, both slide-move and step-move rules, so that new game modes can be added by data (a mode definition) without rewriting core rules logic.

## Problem → Solution
**Before**: Engine hardcodes trap-win + any-distance slide. Mode 2 requires alignment-win + single-step, forcing a rewrite or a fork.
**After**: Optional `win` and `movement` fields on `EngineConfig` (defaults preserve Mode 1 exactly). `legalMoves` and `applyMove` branch on them. One new helper, `alignedPlayer`, checks line ownership. `Move` union grows a `pass` variant for blocked pebbles in alignment mode.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/three-in-a-row.prd.md`
- **PRD Phase**: 1 (Engine seam)
- **Estimated Files**: 2 core (types.ts, rules.ts) + 1 test (morris.test.ts)

---

## UX Design

### Before
Internal change only — no user-facing UX transformation.

### After
Internal change only — no user-facing UX transformation. (Rendering and interaction come in Phase 2.)

---

## Mandatory Reading

| Priority | File | Lines | Why |
|----------|------|-------|-----|
| P0 | `src/game/engine/types.ts` | all | Current EngineConfig, Move types; must extend exactly |
| P0 | `src/game/engine/rules.ts` | all | Current legalMoves/applyMove structure; understand defaults + placement flow |
| P0 | `.claude/PRPs/prds/three-in-a-row.prd.md` | lines 245–357 | Normative spec for engine changes (types, legalMoves, applyMove, alignedPlayer) |
| P1 | `src/game/engine/__tests__/rules.test.ts` | lines 1–90 | Test fixtures (makeState, CFG), test structure for movement/placement |
| P1 | `src/game/engine/ai.ts` | lines 1–50 | Reference for retrograde solve structure (needed context for Phase 3 but not Phase 1 tasks) |
| P1 | `src/game/engine/board.ts` | all | adjacency() function — reused for step-movement edges |

## External Documentation

None needed — feature uses internal patterns only.

---

## Patterns to Mirror

### TYPES_IMMUTABLE
// SOURCE: src/game/engine/types.ts:1–31
```ts
//  engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/).
export interface EngineConfig {
    board: BoardDef;
    pebblesPerPlayer: number;
    repetitionLimit?: number;
    // NEW: optional discriminators added here
}

export type Move =
    | { kind: 'place'; to: VertexId }
    | { kind: 'move'; from: VertexId; to: VertexId };
    // NEW: | { kind: 'pass' };
```
**Rule:** Use `kind` discriminator for exhaustive type narrowing. Defaults on optional fields (e.g. `cfg.win ?? 'trap'`) preserve existing behaviour.

### STATE_IMMUTABILITY
// SOURCE: src/game/engine/rules.ts:62–122
```ts
const board = { ...s.board };  // shallow copy
const next: GameState = { ...s, board, ... };  // never mutate inputs
return next;
```
**Rule:** Always spread copy state. Never mutate `s.board`, `s.placed`, or `s.history` in place.

### MOVE_LEGALITY_CHECK
// SOURCE: src/game/engine/rules.ts:63–70
```ts
const legal = legalMoves(cfg, s).some((lm) =>
    lm.kind === 'place'
        ? m.kind === 'place' && lm.to === m.to
        : m.kind === 'move' && lm.from === m.from && lm.to === m.to
);
if (!legal) throw new Error(`illegal move: ${JSON.stringify(m)}`);
```
**Rule:** Match against all legal moves. Throw `Error` (not a return). **NEW:** Extend with a `pass` arm: `lm.kind === 'pass' ? m.kind === 'pass' : ...`.

### ERROR_THROW_STYLE
// SOURCE: src/game/engine/rules.ts:69
```ts
throw new Error(`illegal move: ${JSON.stringify(m)}`);
```
**Rule:** Error messages include structured context (JSON stringified move). No optional chaining; trust callers.

### TEST_FIXTURE_SETUP
// SOURCE: src/game/engine/__tests__/rules.test.ts:1–20
```ts
const CFG = WELL_MODE.engine;

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
**Rule:** Use a typed `makeState` helper with sensible defaults; override only fields relevant to the test. Import `CFG` at the top of the test file.

### ADJACENCY_GRAPH
// SOURCE: src/game/engine/board.ts:19–29
```ts
export function adjacency(board: BoardDef): Record<VertexId, VertexId[]> {
    const adj: Record<VertexId, VertexId[]> = {};
    for (const v of board.vertices) adj[v.id] = [];
    for (const [a, b] of edgesFromLines(board.lines)) {
        adj[a].push(b);
        adj[b].push(a);
    }
    return adj;
}
```
**Rule:** Reuse existing `edgesFromLines`. Adjacency is unordered (deduped); move order doesn't matter.

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/game/engine/types.ts` | UPDATE | Add `movement?: 'slide' \| 'step'` and `win?: 'trap' \| 'alignment'` to EngineConfig; add `{ kind: 'pass' }` to Move union |
| `src/game/engine/rules.ts` | UPDATE | Add alignedPlayer helper; extend legalMoves with step branch + pass branch; extend applyMove legality check + pass handling + alignment win-check + trap-check gate |
| `src/game/engine/__tests__/morris.test.ts` | CREATE | A1–A9 + A12 test vectors for alignment/step/pass rules |

## NOT Building

- Mode 2 data file or registry entry (Phase 2)
- Alignment AI solver (Phase 3)
- BoardScene render/interaction changes (Phase 2)
- Optional forced-pass auto-apply in UI (Phase 4)

---

## Step-by-Step Tasks

### Task 1: Extend EngineConfig with win/movement discriminators
- **ACTION**: Add two optional fields to `EngineConfig` interface
- **IMPLEMENT**: 
  ```ts
  export interface EngineConfig {
      board: BoardDef;
      pebblesPerPlayer: number;
      repetitionLimit?: number;
      movement?: 'slide' | 'step';   // default 'slide' (Mode 1 unchanged); Mode 2 = 'step'
      win?: 'trap' | 'alignment';    // default 'trap' (Mode 1 unchanged); Mode 2 = 'alignment'
  }
  ```
- **MIRROR**: TYPES_IMMUTABLE — use optional fields with defaults
- **IMPORTS**: No new imports
- **GOTCHA**: Defaults MUST preserve Mode 1 byte-for-byte. Test A12 catches this regression.
- **VALIDATE**: Compile succeeds; type system should accept undefined for both fields

### Task 2: Extend Move union with pass variant
- **ACTION**: Add a third discriminator to Move union
- **IMPLEMENT**:
  ```ts
  export type Move =
      | { kind: 'place'; to: VertexId }
      | { kind: 'move'; from: VertexId; to: VertexId }
      | { kind: 'pass' };
  ```
- **MIRROR**: TYPES_IMMUTABLE — use `kind` discriminator
- **IMPORTS**: No new imports
- **GOTCHA**: This is a breaking change for `applyMove`'s legality check (will fail to compile until legality predicate adds the `pass` arm). Plan Task 5 before merging.
- **VALIDATE**: TypeScript will error until applyMove is updated (Task 5)

### Task 3: Add alignedPlayer helper to rules.ts
- **ACTION**: Export a new pure function that checks if a player owns a full line
- **IMPLEMENT**:
  ```ts
  export function alignedPlayer(cfg: EngineConfig, board: Record<VertexId, PlayerId | null>): PlayerId | null {
      for (const line of cfg.board.lines) {
          const first = board[line[0]];
          if (first !== null && line.every((v) => board[v] === first)) return first;
      }
      return null;
  }
  ```
- **MIRROR**: STATE_IMMUTABILITY — no mutations; pure function
- **IMPORTS**: Already have EngineConfig, VertexId, PlayerId from types
- **GOTCHA**: Only works when all lines have the same length (3 for Mode 2, unconstrained for Mode 1). Tests verify this.
- **VALIDATE**: Test A6 (win on move): apply move that completes a line, check `alignedPlayer` returns the mover

### Task 4: Add step-movement branch to legalMoves
- **ACTION**: Insert a new branch in legalMoves that computes adjacency-based single-step moves
- **IMPLEMENT**: In `legalMoves`, after line 23 (placement check), replace the hardcoded slide logic (lines 28–52) with:
  ```ts
  // phase === 'movement'
  let moves: Move[];
  if ((cfg.movement ?? 'slide') === 'step') {
      const adj = adjacency(cfg.board);
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
  ```
- **MIRROR**: ADJACENCY_GRAPH — use `adjacency(cfg.board)` to build edges
- **IMPORTS**: Import `adjacency` from './board'
- **GOTCHA**: Must preserve the order and deduplication of the slide branch (the code above naturally handles dedup via Set and (from,to) uniqueness). Pass comes after, see Task 5.
- **VALIDATE**: Test A5: board with 3 P1, 3 P2, 3 empty. Assert exactly 6 legal moves (L→C, L→BL, B→BL, B→C, TR→R, TR→C). Assert L→R is NOT legal (two steps away).

### Task 5: Add forced-pass branch to legalMoves + fix legality check
- **ACTION**: After computing piece-moves, conditionally append pass when alignment mode + no piece moves. ALSO fix the legality predicate in applyMove.
- **IMPLEMENT** (legalMoves, continuation of Task 4):
  ```ts
  // forced pass ONLY in alignment mode when otherwise stuck
  if (moves.length === 0 && (cfg.win ?? 'trap') === 'alignment') {
      return [{ kind: 'pass' }];
  }
  return moves;
  ```
  AND (in applyMove, lines 63–70, replace the old legality check):
  ```ts
  const legal = legalMoves(cfg, s).some((lm) =>
      lm.kind === 'pass'  ? m.kind === 'pass'
      : lm.kind === 'place' ? (m.kind === 'place' && lm.to === m.to)
      : (m.kind === 'move' && lm.from === m.from && lm.to === m.to)
  );
  if (!legal) throw new Error(`illegal move: ${JSON.stringify(m)}`);
  ```
- **MIRROR**: MOVE_LEGALITY_CHECK — ternary chain with exhaustive type narrowing
- **IMPORTS**: No new imports (already have Move)
- **GOTCHA**: The pass arm MUST come first. Without it, `lm.from` and `lm.to` don't exist on pass, causing a TS2339 error under strict mode.
- **VALIDATE**: Test A7 (synthetic immobilized board): `legalMoves` returns exactly `[{kind:'pass'}]`. Test A8 (pass semantics): apply pass, verify board/current flip/history.

### Task 6: Handle pass in applyMove (board application)
- **ACTION**: After the legality check, add a conditional branch so pass does not mutate the board
- **IMPLEMENT** (applyMove, after line 70, new branch):
  ```ts
  const board = { ...s.board };
  let placed = s.placed;
  if (m.kind === 'place') {
      board[m.to] = s.current;
      placed = { ...s.placed, [s.current]: s.placed[s.current] + 1 };
  } else if (m.kind === 'move') {
      board[m.from] = null;
      board[m.to] = s.current;
  }
  // if m.kind === 'pass', board and placed unchanged
  ```
- **MIRROR**: STATE_IMMUTABILITY — shallow copy, conditional branches
- **IMPORTS**: No new imports
- **GOTCHA**: Even though pass doesn't modify the board, the placement logic (lines 83–86) still computes `phase` correctly — a pass only happens in movement, so it stays movement.
- **VALIDATE**: Test A8: apply pass, verify board unchanged, current flipped, phase still movement

### Task 7: Add alignment win-check (after move applied, before trap/repetition)
- **ACTION**: Insert a new win-check that fires only after place/move (NOT pass), only in alignment mode
- **IMPLEMENT** (applyMove, after line 95 where `next` is built, before the movement-phase block on line 97):
  ```ts
  // alignment win (new, BEFORE trap/repetition block) — gated off pass
  if (m.kind !== 'pass' && (cfg.win ?? 'trap') === 'alignment') {
      const w = alignedPlayer(cfg, board);
      if (w !== null) return { ...next, phase: 'gameover', winner: w };
  }
  ```
- **MIRROR**: STATE_IMMUTABILITY — return early, no mutations
- **IMPORTS**: Already have alignedPlayer (defined in Task 3)
- **GOTCHA**: MUST gate off `pass` — a pass leaves the board unchanged, and by the pass-unreachability invariant the opponent is already aligned. Without the gate, the first pass would report an opponent win, corrupting winner/current.
- **VALIDATE**: Test A3 (win on placement): apply P1's 3rd pebble to TL,T,TR (top row), verify phase→gameover, winner→1. Test A6 (win on move): move C→T completing top row, verify gameover/winner.

### Task 8: Gate the trap win-check off alignment mode
- **ACTION**: Modify the existing trap check (line 108) so it only fires in trap mode
- **IMPLEMENT** (applyMove, replace line 108):
  ```ts
  // TRAP win — only for trap mode. In alignment mode a stuck player passes instead.
  if ((cfg.win ?? 'trap') !== 'alignment' && legalMoves(cfg, next).length === 0) {
      return { ...next, phase: 'gameover', winner: s.current };
  }
  ```
- **MIRROR**: None (existing code modification)
- **IMPORTS**: No new imports
- **GOTCHA**: The gate is `(cfg.win ?? 'trap') !== 'alignment'`, not `=== 'trap'`, to future-proof for hypothetical other win modes.
- **VALIDATE**: Test A12: use WELL_MODE (no win/movement fields), spot-check that the trap still fires correctly (e.g., E→C traps blue).

### Task 9: Create morris.test.ts with A1–A9 + A12 vectors
- **ACTION**: Create a new test file `src/game/engine/__tests__/morris.test.ts` with all alignment-mode test vectors
- **IMPLEMENT**:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { MORRIS_MODE } from '../../modes/morris';
  import { adjacency } from '../board';
  import { alignedPlayer, applyMove, initialState, legalMoves } from '../rules';
  import type { GameState, VertexId, PlayerId } from '../types';

  const CFG = MORRIS_MODE.engine;

  function makeState(partial: Partial<GameState> & { board: Record<VertexId, PlayerId | null> }): GameState {
      return {
          modeId: 'morris',
          phase: 'movement',
          current: 1,
          placed: { 1: 3, 2: 3 },
          winner: null,
          history: {},
          ...partial
      };
  }

  describe('A1: board sanity', () => {
      it('adjacency derived from lines', () => {
          const adj = adjacency(CFG.board);
          const sorted = Object.fromEntries(
              Object.entries(adj).map(([k, v]) => [k, [...v].sort()])
          );
          // Assert C has 8, all others have 3
          expect(sorted['C']).toHaveLength(8);
          expect(sorted['TL']).toHaveLength(3);
          // Full table in PRD, §Board
      });
  });

  describe('A2: placement start', () => {
      it('initial state gives 9 place moves', () => {
          const moves = legalMoves(CFG, initialState(CFG, 'morris'));
          expect(moves).toHaveLength(9);
          expect(moves.every((m) => m.kind === 'place')).toBe(true);
      });
  });

  // Continue A3–A9, A12 following PRD §Engine Test Vectors
  ```
- **MIRROR**: TEST_FIXTURE_SETUP — use makeState, describe/it from vitest, CFG at top
- **IMPORTS**: Import MORRIS_MODE (will exist after Phase 2, but write the tests now pointing to it)
- **GOTCHA**: MORRIS_MODE doesn't exist yet (Phase 2). Use a conditional import or stub it, or comment it out until Phase 2 starts. For now, write the test structure so Phase 1 can pass, then Phase 2 provides the data.
- **VALIDATE**: Run `npm run test -- morris.test.ts`; all A1–A9 + A12 pass

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|------|-------|-----------------|-----------|
| A1 board sanity | adjacency(CFG.board) | C degree 8, others degree 3 | No |
| A2 placement start | initialState | 9 place moves (all empty vertices) | No |
| A3 win on placement | ['TL','BL','T','BR','TR'] | gameover, winner 1 after 5th | Yes — earliest possible win |
| A4 no premature win | ['TL','T'] | still placement, winner null | Yes — two pebbles can't align |
| A5 single-step movement | 3/3/3 board, P1 to move | exactly 6 legal moves, L→R NOT legal | Yes — verify step, not slide |
| A6 win on move | C→T completes top row | gameover, winner 1 | Yes — move creates alignment |
| A7 forced pass (synthetic) | all P1 pebbles surrounded | legalMoves = [{kind:'pass'}] | Yes — immobilized board |
| A8 pass semantics | apply pass to A7 board | current flips, board unchanged, history updated | Yes — defensive coverage |
| A9 draw by threefold repetition | 6-ply oscillation | gameover, winner null | Yes — repetition cycle |
| A12 Mode 1 untouched | WELL_MODE, trap vector T4 (E→C traps blue) | gameover, winner 1 | Yes — regression guard |

### Edge Cases Checklist
- [x] Empty board (placement start)
- [x] Single pebble (not aligned)
- [x] Two pebbles (not aligned)
- [x] Three pebbles aligned (win)
- [x] All three pieces surrounded (pass)
- [x] Repeated position (draw)
- [x] Defaults preserve Mode 1 (regression)

---

## Validation Commands

### Static Analysis
```bash
npm run type-check
```
EXPECT: Zero type errors (especially after adding pass to Move and updating legality predicate)

### Unit Tests
```bash
npm run test -- morris.test.ts
```
EXPECT: A1–A9, A12 all pass

### Full Test Suite (Mode 1 regression)
```bash
npm run test
```
EXPECT: All existing tests in rules.test.ts, ai.test.ts, sanity.test.ts pass unchanged (no edits to those files)

### Manual Verification
- [ ] Compile locally: `npm run build` succeeds
- [ ] No console warnings or errors
- [ ] Import paths correct (adjacency from board.ts, Move type exports)

---

## Acceptance Criteria
- [x] EngineConfig has optional win/movement fields with correct defaults
- [x] Move union includes pass variant
- [x] alignedPlayer helper exported and correct
- [x] legalMoves step branch implemented and tested (A5)
- [x] legalMoves pass branch implemented and tested (A7)
- [x] applyMove legality predicate handles all three move kinds (A8 pass acceptance, A3/A6 place/move acceptance)
- [x] applyMove pass handling (board/placed unchanged, history updated)
- [x] applyMove alignment win-check gated off pass (A8)
- [x] applyMove trap check gated off alignment mode (A12)
- [x] All Mode 1 tests green (A12 + full suite)
- [x] No type errors
- [x] No lint errors

## Completion Checklist
- [ ] types.ts: EngineConfig + Move updated (Tasks 1–2)
- [ ] rules.ts: alignedPlayer added (Task 3)
- [ ] rules.ts: legalMoves step branch added (Task 4)
- [ ] rules.ts: legalMoves pass branch + applyMove legality predicate updated (Task 5)
- [ ] rules.ts: applyMove pass handling (Task 6)
- [ ] rules.ts: applyMove alignment win-check (Task 7)
- [ ] rules.ts: applyMove trap-check gate (Task 8)
- [ ] morris.test.ts created with A1–A9 + A12 (Task 9)
- [ ] `npm run test` all pass (no Mode 1 regressions)
- [ ] `npm run type-check` zero errors

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Defaults leak and change Mode 1 | M | All trap games fail | Defaults on every `cfg.win`, `cfg.movement`; A12 catches this |
| Pass accepted but applyMove crashes on `.from` read | M | Type error at runtime | Legality predicate MUST have `pass` arm first before any `.from` read |
| Alignment checked after pass | M | First pass wrongly reports opponent win | Alignment check gated `m.kind !== 'pass'` |
| Step branch misses edges | M | AI trapped on unreachable board | A5 tests all 6 moves; manual verification of adjacency |
| Trap check fires in alignment mode | H | Stuck player loses instead of passing | Trap check gated `win !== 'alignment'` |

---

## Notes

1. **Import MORRIS_MODE in Phase 2**: morris.test.ts will import MORRIS_MODE from `src/game/modes/morris/index.ts`, which doesn't exist yet. Either stub it, conditionally skip the import, or add it in Phase 2 before running full test suite.

2. **adjacency() called per legalMoves**: The step branch calls `adjacency(cfg.board)` on every legalMoves query. This is correct but not optimized (rebuilds the 9-node graph each time). Phase 3 (AI) memoises it for the solver's ~3360 iterations; Phase 1 leaves it as-is.

3. **Pass is provably unreachable**: The pass-unreachability invariant (immobilizing 3 pebbles forces opponent onto a line) means synthetic tests A7/A8 exercise dead code. They're defensive coverage, not reachable in real play. Tests catch potential bugs if the invariant changes.

4. **positionKey already exported from ai.ts**: The function on line 5 of ai.ts is exported and used by the retrograde solver. It's not imported into rules.ts (rules.ts has a local version, line 58), which is fine — they're identical. Phase 3 will use the ai.ts version for the solver; rules.ts keeps its local copy for history tracking.

---

*Generated for Phase 1 of `.claude/PRPs/prds/three-in-a-row.prd.md`*
*Status: READY FOR IMPLEMENTATION*
