# Plan: Phase 2 — Engine (Pebble Trap)

## Summary
Implement the complete, pure-TS rules engine for Mode 1: `board.ts` (edges/adjacency from lines), `rules.ts` (initialState/legalMoves/applyMove), the well-mode definition + registry entry, and the full vitest suite including normative vectors T1–T7. Zero rendering, zero phaser imports.

## User Story
As the developer, I want correct, tested game rules isolated from rendering, so that phase 4 wires UI to a trustworthy core and future modes reuse it.

## Problem → Solution
Skeleton has types only → engine functions implementing PRD "Game Rules (NORMATIVE)" exactly, proven by T1–T7 + supplementary tests.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/pebble-trap.prd.md`
- **PRD Phase**: 2 — Engine
- **Estimated Files**: 5 (4 create, 1 update)

## UX Design
N/A — internal change. No user-facing surface this phase.

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | `.claude/PRPs/prds/pebble-trap.prd.md` — "Game Rules (NORMATIVE)" + "Trap Math" + "Engine Test Vectors" + "Core engine types + signatures" | the law this phase implements |
| P0 | `src/game/engine/types.ts` | existing normative types — do NOT change them |
| P1 | `src/game/modes/types.ts`, `src/game/modes/registry.ts` | GameModeDef shape, registry to fill |
| P2 | `src/game/engine/__tests__/sanity.test.ts` | test style (describe/it/expect from 'vitest') |

## External Documentation
None needed — pure TS, established internal patterns.

---

## Patterns to Mirror

### CODE_STYLE
// SOURCE: src/game/engine/types.ts (phase 1)
4-space indent, single quotes, semicolons. Pure functions, no classes in engine.

### LAYERING (review-blocker if violated)
`engine/` imports nothing outside `engine/`. `modes/` imports engine types. Tests (in `engine/__tests__/`) MAY import `modes/well` as a data fixture — tests are consumers, not engine source.

### GAMEOVER_SEMANTICS
// SOURCE: PRD Win Condition
`phase:'gameover'`, `winner` = player who just moved, `current` = trapped player.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/game/engine/board.ts` | CREATE | edges + adjacency derived from lines |
| `src/game/engine/rules.ts` | CREATE | initialState / legalMoves / applyMove |
| `src/game/modes/well/index.ts` | CREATE | Mode 1 data (engine config + boardStrokes) — single source, tests + phase 3 both consume |
| `src/game/modes/registry.ts` | UPDATE | register WELL_MODE |
| `src/game/engine/__tests__/rules.test.ts` | CREATE | T1–T7 + supplementary tests |

## NOT Building
- Rendering, input, HUD (phases 3–4); AI; draw rules; rule hooks for modes 2–3 (seam documented, not built)
- Changes to `engine/types.ts` (frozen normative)
- `.gitkeep` in `modes/well/` becomes obsolete — delete it when index.ts lands

---

## Step-by-Step Tasks

### Task 1: `src/game/engine/board.ts`
- **IMPLEMENT** (complete file):
```ts
import type { BoardDef, VertexId } from './types';

//  Edges are the consecutive pairs of each line, deduplicated (unordered).
export function edgesFromLines(lines: VertexId[][]): [VertexId, VertexId][] {
    const seen = new Set<string>();
    const edges: [VertexId, VertexId][] = [];
    for (const line of lines) {
        for (let i = 0; i + 1 < line.length; i++) {
            const key = [line[i], line[i + 1]].sort().join('-');
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([line[i], line[i + 1]]);
            }
        }
    }
    return edges;
}

export function adjacency(board: BoardDef): Record<VertexId, VertexId[]> {
    const adj: Record<VertexId, VertexId[]> = {};
    for (const v of board.vertices) {
        adj[v.id] = [];
    }
    for (const [a, b] of edgesFromLines(board.lines)) {
        adj[a].push(b);
        adj[b].push(a);
    }
    return adj;
}
```
- **VALIDATE**: `npm run typecheck`

### Task 2: Well mode data + registry
- **IMPLEMENT** — `src/game/modes/well/index.ts` (complete file; data is PRD-normative, do not adjust):
```ts
import type { GameModeDef } from '../types';

export const WELL_MODE: GameModeDef = {
    id: 'well',
    name: 'Well Board',
    engine: {
        pebblesPerPlayer: 2,
        board: {
            vertices: [
                { id: 'C', x: 360, y: 560 },
                { id: 'N', x: 360, y: 290 },
                { id: 'E', x: 630, y: 560 },
                { id: 'S', x: 360, y: 830 },
                { id: 'W', x: 90, y: 560 }
            ],
            lines: [
                ['N', 'C', 'S'],
                ['W', 'C', 'E'],
                ['E', 'N', 'W', 'S']
            ]
        }
    },
    boardStrokes: [
        { kind: 'segment', from: 'N', to: 'S' },
        { kind: 'segment', from: 'W', to: 'E' },
        { kind: 'arc', cx: 360, cy: 560, radius: 270, startDeg: 90, endDeg: 360 }
    ]
};
```
Update `src/game/modes/registry.ts`:
```ts
import type { GameModeDef } from './types';
import { WELL_MODE } from './well';

export const MODES: Record<string, GameModeDef> = {
    [WELL_MODE.id]: WELL_MODE
};
```
Delete `src/game/modes/well/.gitkeep`.
- **GOTCHA**: rim line is `['E','N','W','S']` — E-to-S has NO pair because the S–E arc doesn't exist. Never "fix" this into a cycle.
- **VALIDATE**: `npm run typecheck`

### Task 3: `src/game/engine/rules.ts`
- **IMPLEMENT** (complete file):
```ts
import type { EngineConfig, GameState, Move, PlayerId, VertexId } from './types';

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
        winner: null
    };
}

export function legalMoves(cfg: EngineConfig, s: GameState): Move[] {
    if (s.phase === 'gameover') {
        return [];
    }
    if (s.phase === 'placement') {
        return Object.keys(s.board)
            .filter((id) => s.board[id] === null)
            .map((to) => ({ kind: 'place' as const, to }));
    }
    //  movement: slide along a line, any distance, stop at any empty vertex
    //  strictly before the first occupied one. Dedupe by (from,to) — a
    //  destination reachable via two lines is one move.
    const moves: Move[] = [];
    const seen = new Set<string>();
    for (const line of cfg.board.lines) {
        for (let i = 0; i < line.length; i++) {
            if (s.board[line[i]] !== s.current) {
                continue;
            }
            for (const dir of [1, -1]) {
                for (let j = i + dir; j >= 0 && j < line.length; j += dir) {
                    if (s.board[line[j]] !== null) {
                        break;
                    }
                    const key = `${line[i]}>${line[j]}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        moves.push({ kind: 'move', from: line[i], to: line[j] });
                    }
                }
            }
        }
    }
    return moves;
}

export function applyMove(cfg: EngineConfig, s: GameState, m: Move): GameState {
    const legal = legalMoves(cfg, s).some((lm) =>
        lm.kind === 'place'
            ? m.kind === 'place' && lm.to === m.to
            : m.kind === 'move' && lm.from === m.from && lm.to === m.to
    );
    if (!legal) {
        throw new Error(`illegal move: ${JSON.stringify(m)}`);
    }

    const board = { ...s.board };
    let placed = s.placed;
    if (m.kind === 'place') {
        board[m.to] = s.current;
        placed = { ...s.placed, [s.current]: s.placed[s.current] + 1 };
    } else {
        board[m.from] = null;
        board[m.to] = s.current;
    }

    //  placement ends after 2 × pebblesPerPlayer total placements — never hardcode 4
    const phase =
        s.phase === 'placement' && placed[1] + placed[2] < 2 * cfg.pebblesPerPlayer
            ? 'placement'
            : 'movement';

    const next: GameState = {
        ...s,
        board,
        placed,
        phase,
        current: s.current === 1 ? 2 : 1,
        winner: null
    };

    //  trap check runs after EVERY move, including the final placement (PRD T7):
    //  gameover keeps current = trapped player, winner = mover
    if (next.phase === 'movement' && legalMoves(cfg, next).length === 0) {
        return { ...next, phase: 'gameover', winner: s.current };
    }
    return next;
}
```
- **GOTCHA 1**: trap check must run on the placement→movement transition too — an implementation checking only after movement moves passes T1–T6 and soft-locks (that's exactly what T7 guards).
- **GOTCHA 2**: never mutate the input state — copy `board` and `placed`.
- **GOTCHA 3**: `placed` uses computed key `[s.current]` — TS may widen; keep `placed` typed `Record<PlayerId, number>`.
- **VALIDATE**: `npm run typecheck && npm test`

### Task 4: `src/game/engine/__tests__/rules.test.ts`
- **IMPLEMENT**: fixture helper + vectors. Structure (complete the obvious bodies the same way):
```ts
import { describe, expect, it } from 'vitest';
import { WELL_MODE } from '../../modes/well';
import { edgesFromLines, adjacency } from '../board';
import { applyMove, initialState, legalMoves } from '../rules';
import type { GameState, Move, PlayerId, VertexId } from '../types';

const CFG = WELL_MODE.engine;

//  PRD fixture note: vectors list decision-relevant fields; helper fills defaults.
function makeState(partial: Partial<GameState> & { board: Record<VertexId, PlayerId | null> }): GameState {
    return {
        modeId: 'well',
        phase: 'movement',
        current: 1,
        placed: { 1: 2, 2: 2 },
        winner: null,
        ...partial
    };
}

const dests = (s: GameState) =>
    (legalMoves(CFG, s) as Extract<Move, { kind: 'move' }>[]).map((m) => m.to).sort();
```
Required tests:
  - **T1 board sanity**: `edgesFromLines(CFG.board.lines)` has length 7; contains each of N-C, C-S, W-C, C-E, E-N, N-W, W-S (unordered compare); no S-E pair. Plus: `adjacency(CFG.board)` deep-equals the PRD table `{C:[N,E,S,W], N:[C,E,W], E:[C,N], S:[C,W], W:[C,N,S]}` (sort each list before compare).
  - **T2 placement**: `legalMoves(CFG, initialState(CFG, 'well'))` → exactly 5 moves, every `kind === 'place'`.
  - **T3 trap detect**: `makeState({ board: { C: 1, N: 1, E: null, S: 2, W: 2 }, current: 2 })` → `legalMoves` is `[]`.
  - **T4 win on move**: `makeState({ board: { E: 1, N: 1, S: 2, W: 2, C: null }, current: 1 })`, apply `{kind:'move', from:'E', to:'C'}` → `phase:'gameover'`, `winner:1`, and `current:2` (trapped player, per PRD gameover semantics).
  - **T5 slide + dedupe**: `makeState({ board: { S: 1, C: null, N: null, E: null, W: null }, placed: { 1: 1, 2: 0 } })` → `dests` exactly `['C','E','N','W']`.
  - **T6 blocking**: red S, blue C+W, rest null → `legalMoves` for current 1 is `[]`.
  - **T7 trap on final placement**: from `initialState`, apply places S, C, W, N in order → final state `phase:'gameover'`, `winner:2`, `current:1`.
  - **Supplementary** (each one `it`):
    - placement alternates: after P1 places, `current` is 2 and `placed` counts update;
    - placement→movement transition: after 4 places (non-trap sequence C, N, W, S — P1 holds C+W, empty E, E adjacent C → P1 can move) assert `phase:'movement'`, `current:1`;
    - illegal place on occupied vertex throws;
    - illegal move of opponent's pebble throws;
    - illegal slide through occupied vertex throws (e.g. T6 state, try S→N);
    - `legalMoves` of gameover state is `[]`;
    - `applyMove` does not mutate input (snapshot compare via structuredClone);
    - full scripted game continuing past a non-trap move: places C(P1), S(P2), N(P1), W(P2) → movement, P1 moves C→E → assert NOT gameover (blue W adjacent to now-empty C → blue can move).
- **GOTCHA**: T5/T6 use `placed` values impossible in real mode-1 play — engine-general fixtures, intentionally legal at engine level (PRD labels them "unreachable in mode-1 play").
- **VALIDATE**: `npm test` → all green.

### Task 5: Validation sweep
- **VALIDATE**:
```bash
npm run typecheck                                   # zero errors
npm test                                            # all tests green (≥ 15)
grep -rn "from 'phaser'\|from \"phaser\"" src/game/engine/   # NO output — engine purity
grep -rn "modes/" src/game/engine/*.ts              # NO output (tests excluded — __tests__ may import modes)
npm run build                                       # still builds
```

---

## Testing Strategy
The tests ARE the deliverable spec — T1–T7 normative from PRD plus 8 supplementary. Edge cases: occupied placement, opponent pebble, blocked slide, gameover no-moves, immutability, transition trap.

## Validation Commands
See Task 5. EXPECT: typecheck 0 errors; ≥15 tests pass; purity greps empty; build clean.

## Acceptance Criteria
- [ ] T1–T7 implemented exactly as PRD states, all green
- [ ] Supplementary tests green
- [ ] `engine/` purity greps clean
- [ ] `WELL_MODE` registered; `.gitkeep` removed
- [ ] `engine/types.ts` untouched

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Subtle slide-rule bug | L | H | T5/T6 + blocked-slide-throws cover both misreadings (forced-max vs stop-anywhere) |
| Transition trap missed | L | H | T7 exists precisely for this |

## Notes
- Phase 3 (board render) may run after this or in parallel — it needs only `WELL_MODE.boardStrokes` + vertices (Task 2 here), not rules.
- Engine code style: pure functions, no classes, no Date/random — deterministic.
