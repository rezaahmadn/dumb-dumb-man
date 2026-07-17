# Plan: Pebble Clash — Phase 4: Greedy AI

## Summary

A pure, deterministic, capture-preferring AI for elimination-mode boards, in a new `engine/aiGreedy.ts`. It must never call `solveMovementGraph` (the existing retrograde solver) — that solver enumerates every board layout via `kCombinations`, which is combinatorially infeasible at 16 pebbles/side on a 37-vertex board (would hang or OOM). `aiGreedy` instead scores each legal move directly with a one-ply heuristic: prefer longer capture chains, then material/mobility.

## User Story

As a solo player, I want the AI to reliably take an available capture and play a competent one-ply game, so vs-AI Pebble Clash is a real opponent rather than a random-mover.

## Problem → Solution

`chooseMove` in `engine/ai.ts` always calls `solveMovementGraph`, correct for small boards (≤3 pebbles, `well`/`morris`) but architecturally cannot scale to 16-pebble draughts. → A parallel, independent `chooseMoveGreedy` in `engine/aiGreedy.ts` that never touches the solver, dispatched by `win === 'elimination'`.

## Metadata

- **Complexity**: Small — one new pure function, one dispatch branch.
- **Source PRD**: `.claude/PRPs/prds/pebble-clash.prd.md`
- **PRD Phase**: 4 — "Greedy AI"
- **Estimated Files**: 3 (2 CREATE, 1 UPDATE)
- **Depends on**: Phase 3 (legalMoves/applyMove for draughts must exist and be correct).

---

## UX Design

**N/A — internal.** Only visible effect (once Phase 6 wires the mode) is a smarter AI move choice.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/game/engine/ai.ts` | 1–145 | Existing solver + `chooseMove` shape. Do NOT modify. Mirror the export shape; do NOT import `solveMovementGraph`. |
| P0 | `src/game/scenes/BoardScene.ts` | 394–405 (`maybeScheduleAiMove`) | The ONE call site that must dispatch to the new AI. |
| P0 | `src/game/engine/rules.ts` | `pebbleCount`, `legalMoves`, `applyMove` (Phase 3 additions) | Functions `aiGreedy` calls. |
| P1 | `src/game/engine/__tests__/ai.test.ts` | 1–40 | Test conventions: `sameMove` helper, `T-AI<n>` prefix — mirror with `G<n>`. |
| P1 | `src/game/engine/__tests__/clash.test.ts` | `FIXTURE` | Reuse/extend for greedy tests. |

## External Documentation

None.

---

## Patterns to Mirror

### AI_EXPORT_SHAPE
```ts
// SOURCE: src/game/engine/ai.ts:132-145
export function chooseMove(cfg: EngineConfig, s: GameState): Move {
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
`>` (strictly greater) tie-break — first max-scoring move wins. Mirror exactly for determinism.

### DISPATCH_SITE
```ts
// SOURCE: src/game/scenes/BoardScene.ts:394-405
private maybeScheduleAiMove ()
{
    if (this.opponentType !== 'ai' || this.state.current !== AI_PLAYER || this.state.phase === 'gameover')
    {
        return;
    }
    this.time.delayedCall(THEME.aiMoveDelayMs, () =>
    {
        const move = chooseMove(this.mode.engine, this.state);
        this.applyAndSync(move);
    });
}
```
Allman braces (BoardScene house style).

### COMMENT_STYLE
`//` + two spaces, rationale-heavy.

---

## Files to Change

| File | Action |
|---|---|
| `src/game/engine/aiGreedy.ts` | CREATE — greedy AI, isolated from the solver |
| `src/game/scenes/BoardScene.ts` | UPDATE — one-line dispatch change |
| `src/game/engine/__tests__/aiGreedy.test.ts` | CREATE — test vectors G1–G5 |

## NOT Building

- **Any change to `engine/ai.ts` or `solveMovementGraph`** — dispatch lives in `BoardScene.ts`, not inside `chooseMove`.
- **1–2 ply lookahead** — PRD marks this "Could", deferred.
- **Mode registration / real board** → Phase 5.

---

## Step-by-Step Tasks

### Task 1: Write `engine/aiGreedy.ts`

```ts
//  engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/).
//  Deliberately independent of ai.ts / solveMovementGraph: that solver
//  enumerates every board layout (kCombinations over all vertices) and is
//  combinatorially infeasible above a handful of pebbles per side. This file
//  must NEVER import solveMovementGraph — a guard test in aiGreedy.test.ts
//  asserts that statically.
import { applyMove, legalMoves, pebbleCount } from './rules';
import type { EngineConfig, GameState, Move, PlayerId } from './types';

function opponentOf(p: PlayerId): PlayerId {
    return p === 1 ? 2 : 1;
}

//  Capture count of a move: hop count for a jump, 0 otherwise. Chains are
//  already enumerated maximal by legalMoves (Phase 3).
function captureCount(m: Move): number {
    return m.kind === 'jump' ? m.hops.length : 0;
}

//  One-ply score: captures dominate (weight 1000) over material (10) over
//  opponent mobility (1), so no combination of the latter two can ever
//  outweigh one extra capture — matches "AI takes available capture: 100%"
//  from the PRD's Success Metrics.
function scoreMove(cfg: EngineConfig, s: GameState, m: Move): number {
    const captures = captureCount(m);
    const child = applyMove(cfg, s, m);
    const material = pebbleCount(child.board, s.current) - pebbleCount(child.board, opponentOf(s.current));
    //  legalMoves on a gameover state returns [] (rules.ts), so this is 0
    //  when the move just won the game — correct value for "no replies".
    const opponentMobility = child.phase === 'gameover' ? 0 : legalMoves(cfg, child).length;
    return captures * 1000 + material * 10 - opponentMobility;
}

//  Deterministic, no RNG: iterates legalMoves in its own fixed order, keeps
//  the FIRST max-scoring move (strict '>'), mirroring chooseMove's tie-break
//  in ai.ts.
export function chooseMoveGreedy(cfg: EngineConfig, s: GameState): Move {
    const moves = legalMoves(cfg, s);
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
        const score = scoreMove(cfg, s, m);
        if (score > bestScore) {
            bestScore = score;
            best = m;
        }
    }
    return best;
}
```

- **MIRROR**: AI_EXPORT_SHAPE (tie-break), COMMENT_STYLE.
- **GOTCHA**: `applyMove` already flips `current` on its returned state (verify against the real `rules.ts` before trusting this) — so `legalMoves(cfg, child)` inside `scoreMove` already enumerates the OPPONENT's moves without any extra override. Confirm this against the actual Phase 2/3 implementation before relying on it; if `applyMove` does NOT flip current in some edge case (e.g. gameover), that's exactly why the `child.phase === 'gameover'` branch exists above.
- **VALIDATE**: `npm run typecheck` green.

### Task 2: Dispatch on `win === 'elimination'` in `BoardScene.ts`

Add import:
```ts
import { chooseMoveGreedy } from '../engine/aiGreedy';
```

Change `maybeScheduleAiMove`:
```ts
    private maybeScheduleAiMove ()
    {
        if (this.opponentType !== 'ai' || this.state.current !== AI_PLAYER || this.state.phase === 'gameover')
        {
            return;
        }
        this.time.delayedCall(THEME.aiMoveDelayMs, () =>
        {
            //  Elimination-mode boards (Pebble Clash) are too large for the
            //  retrograde solver (kCombinations over 37 vertices at k=16)
            //  — hard dispatch here, never inside chooseMove itself, so
            //  well/morris's call path is untouched.
            const move = this.mode.engine.win === 'elimination'
                ? chooseMoveGreedy(this.mode.engine, this.state)
                : chooseMove(this.mode.engine, this.state);
            this.applyAndSync(move);
        });
    }
```

- **MIRROR**: DISPATCH_SITE — minimal diff, not a rewrite.
- **GOTCHA**: This is the ONLY dispatch point. Do not add a second one elsewhere.
- **VALIDATE**: `npm run typecheck` green; `npm test` — existing `ai.test.ts` unchanged/green.

### Task 3: Write test vectors G1–G5

Create `src/game/engine/__tests__/aiGreedy.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { legalMoves } from '../rules';
import { chooseMoveGreedy } from '../aiGreedy';
import type { EngineConfig, GameState } from '../types';

//  5-vertex line so a jump can chain twice — a - b - c - d - e
const CFG: EngineConfig = {
    pebblesPerPlayer: 1,
    win: 'elimination',
    movement: 'draughts',
    board: {
        vertices: [
            { id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }, { id: 'c', x: 2, y: 0 },
            { id: 'd', x: 3, y: 0 }, { id: 'e', x: 4, y: 0 }
        ],
        lines: [['a', 'b', 'c', 'd', 'e']]
    }
};

function stateWith(board: GameState['board'], current: 1 | 2 = 1): GameState {
    return { modeId: 'clash', phase: 'movement', board, current, placed: { 1: 1, 2: 1 }, winner: null, history: {} };
}

describe('G1 takes the only capture', () => {
    it('prefers a jump over a quiet move when both are legal', () => {
        const s = stateWith({ a: 1, b: 2, c: null, d: null, e: null });
        expect(chooseMoveGreedy(CFG, s).kind).toBe('jump');
    });
});

describe('G2 prefers the longer chain', () => {
    it('picks the 2-hop chain when one is available', () => {
        //  a:1, b:2, c:empty, d:2, e:empty — a maximal chain a>c>e should
        //  exist once Phase 3's chain enumeration runs on this board. If it
        //  doesn't materialize as-is, adjust occupancy until legalMoves(CFG,
        //  s) contains a jump with hops.length === 2, then assert on that.
        const s = stateWith({ a: 1, b: 2, c: null, d: 2, e: null });
        const chosen = chooseMoveGreedy(CFG, s);
        expect(chosen.kind).toBe('jump');
        if (chosen.kind === 'jump') expect(chosen.hops).toHaveLength(2);
    });
});

describe('G3 returns a legal move on a fresh board', () => {
    it('the chosen move is always in legalMoves', () => {
        const s = stateWith({ a: 1, b: null, c: null, d: null, e: 2 });
        const moves = legalMoves(CFG, s);
        expect(moves).toContainEqual(chooseMoveGreedy(CFG, s));
    });
});

describe('G4 deterministic', () => {
    it('returns the identical move across repeated calls', () => {
        const s = stateWith({ a: 1, b: null, c: null, d: null, e: 2 });
        expect(chooseMoveGreedy(CFG, s)).toEqual(chooseMoveGreedy(CFG, s));
    });
});

describe('G5 never calls the retrograde solver', () => {
    it('aiGreedy.ts does not import solveMovementGraph or ai.ts', () => {
        const path = fileURLToPath(new URL('../aiGreedy.ts', import.meta.url));
        const src = readFileSync(path, 'utf-8');
        expect(src).not.toMatch(/solveMovementGraph/);
        expect(src).not.toMatch(/from '\.\/ai'/);
    });
});
```

- **MIRROR**: TEST_STRUCTURE from `ai.test.ts` (`T-AI<n>` → `G<n>`).
- **GOTCHA**: G2's exact board may need adjusting once the real Phase 3 chain enumeration is in place — the comment explains intent (force a 2-hop maximal chain), don't hardcode blind if it doesn't materialize.
- **VALIDATE**: `npm test` — all 5 pass (G4/G5 always pass regardless of Phase 3 specifics).

---

## Testing Strategy

| Test | Input | Expected | Edge Case? |
|---|---|---|---|
| G1 | Single capture available | AI takes it | no |
| G2 | Short + long chain available | AI takes longer | **yes** |
| G3 | Fresh board | Legal move returned | no |
| G4 | Same state twice | Identical result | no |
| G5 | Static source scan | No solver import | **yes — structural** |

---

## Validation Commands

```bash
npm run typecheck
npm test
```
EXPECT: zero errors; all green, no `well`/`morris` regression.

---

## Acceptance Criteria

- [ ] `aiGreedy.ts` exports `chooseMoveGreedy(cfg, s): Move`, imports nothing from `ai.ts`
- [ ] `BoardScene.maybeScheduleAiMove` dispatches on `win === 'elimination'`
- [ ] G1–G5 all pass
- [ ] `well`/`morris` AI behaviour unchanged

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `applyMove` current-flip assumption wrong | M | Task 1 GOTCHA: verify against real `rules.ts` before trusting |
| G2 fixture doesn't produce the intended chain | M | Task 3 GOTCHA: adjust board, don't hardcode blind |
| Second dispatch point added later | L | Comment states single decision point |

---

*Next: Phase 5 (mode def + registry) — needs Phase 3 rules + this AI, assembles the real board.*
