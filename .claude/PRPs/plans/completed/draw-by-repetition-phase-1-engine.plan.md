# Plan: Draw by Threefold Repetition — Phase 1 (Engine Draw Detection)

> Every move sequence below (T8's 6-ply cycle, T10's 3-ply prefix, T11's 3x
> repeat) was hand-traced against the actual `legalMoves`/`applyMove` logic
> during planning and independently verified by an adversarial review via
> exhaustive search of the 60-position movement graph. Do not "simplify" the
> moves — an earlier draft's naive "out and back" shuffle was proven
> IMPOSSIBLE (single empty vertex means ply 2 can never undo ply 1). Use the
> exact moves given.

## Summary
Add threefold-position-repetition draw detection to the engine: record every movement-phase position in `GameState.history`, and when a position's count reaches `EngineConfig.repetitionLimit` (well = 3), `applyMove` ends the game as a draw (`phase:'gameover'`, `winner:null`). Pure engine change — zero rendering, zero `BoardScene` edits.

## User Story
As a player, I want a game that's settled into an endless cycle to end automatically in a draw, so we're not stuck restarting manually.

## Problem → Solution
Engine has no draw path (only trap-win) → `applyMove` detects the 3rd occurrence of any `(board, side-to-move)` and returns a draw, gated by an opt-in config field so other future modes aren't affected unless they opt in.

## Metadata
- **Complexity**: Small
- **Source PRD**: `.claude/PRPs/prds/draw-by-repetition.prd.md`
- **PRD Phase**: 1 — Engine draw detection
- **Estimated Files**: 4 (all UPDATE)

## UX Design
N/A — internal engine change. Phase 2 (separate PRD phase) makes it visible in the HUD.

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | `.claude/PRPs/prds/draw-by-repetition.prd.md` — full "Solution Detail" section | normative rules, exact key format, exact ordering, exact T8 cycle |
| P0 | `src/game/engine/rules.ts` (current, read below) | file being extended — the `applyMove` you're modifying |
| P0 | `src/game/engine/types.ts` (current, read below) | `GameState`/`EngineConfig` you're extending |
| P1 | `src/game/engine/__tests__/rules.test.ts` (current, read below) | `makeState` helper + existing test style you extend, T1–T7 must stay green untouched |
| P1 | `src/game/modes/well/index.ts` (current, read below) | one-line addition (`repetitionLimit: 3`) |

## External Documentation
None needed — pure internal TS, no libraries involved.

---

## Patterns to Mirror

### CODE_STYLE
// SOURCE: src/game/engine/rules.ts (current)
4-space indent, single quotes, semicolons, brace-on-same-line for functions. Comments only where a non-obvious invariant needs explaining (existing file's style — e.g. the T7 comment on the trap check).

### IMMUTABILITY
// SOURCE: src/game/engine/rules.ts:64,80-87 (current)
`applyMove` never mutates `s`; always spreads into new objects (`{ ...s.board }`, `{ ...s, ... }`). The history addition must follow this exactly — copy the history record before writing to it.

### TEST_STRUCTURE
// SOURCE: src/game/engine/__tests__/rules.test.ts (current)
`describe`/`it` blocks per concern, `makeState` fixture helper with sensible defaults overridden per test, `CFG = WELL_MODE.engine` as the shared config, `Move[]` sequences applied via a loop for multi-ply scripts (already used in T7's placement loop).

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/game/engine/types.ts` | UPDATE | add `history?` to `GameState`, `repetitionLimit?` to `EngineConfig` |
| `src/game/engine/rules.ts` | UPDATE | `positionKey` helper + history recording + draw check in `applyMove` |
| `src/game/modes/well/index.ts` | UPDATE | `repetitionLimit: 3` |
| `src/game/engine/__tests__/rules.test.ts` | UPDATE | `makeState` history default, `keyOf` test helper, T8–T12 |

## NOT Building
- Any HUD/rendering change (separate PRD phase 2)
- `BoardScene` changes — none needed, it's already generic over engine state
- Claimable draws, move-count draws, draw-by-agreement (PRD "Won't")
- Any change to modes 2/3 (don't exist)

---

## Step-by-Step Tasks

### Task 1: `src/game/engine/types.ts` — add optional fields
- **ACTION**: add `repetitionLimit?: number;` to `EngineConfig`, add `history?: Record<string, number>;` to `GameState` (both as the last field in their interface — additive, minimal diff).
- **IMPLEMENT** (current file with the two additions applied):
```ts
//  engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/).
//  These types are normative — defined in .claude/PRPs/prds/pebble-trap.prd.md.

export type VertexId = string;
export type PlayerId = 1 | 2;
export type Phase = 'placement' | 'movement' | 'gameover';

export interface BoardDef {
    vertices: { id: VertexId; x: number; y: number }[];
    lines: VertexId[][];
}

export interface EngineConfig {
    board: BoardDef;
    pebblesPerPlayer: number;
    repetitionLimit?: number;
}

export interface GameState {
    modeId: string;
    phase: Phase;
    board: Record<VertexId, PlayerId | null>;
    current: PlayerId;
    placed: Record<PlayerId, number>;
    winner: PlayerId | null;
    history?: Record<string, number>;
}

export type Move =
    | { kind: 'place'; to: VertexId }
    | { kind: 'move'; from: VertexId; to: VertexId };
```
- **GOTCHA**: both new fields are OPTIONAL (`?`). This keeps every existing partial-state test fixture compiling without edits and makes the feature opt-in per `EngineConfig` (modes that omit `repetitionLimit` never draw).
- **VALIDATE**: `npm run typecheck`

### Task 2: `src/game/engine/rules.ts` — position key, recording, draw check
- **ACTION**: add a `positionKey` helper; rewrite `applyMove`'s tail (from the `next` construction onward) to record history and check draw after the existing trap check.
- **IMPLEMENT** — insert this function directly above `applyMove` (after `legalMoves`, same file):
```ts
//  Position = board layout (in fixed vertex order) + side-to-move. Only
//  called on movement-phase states — placement positions strictly gain
//  pebbles and can never recur, so they're never keyed.
function positionKey(cfg: EngineConfig, s: GameState): string {
    return cfg.board.vertices.map((v) => s.board[v.id] ?? '.').join('') + '|' + s.current;
}
```
Then replace the ENTIRE `applyMove` function with:
```ts
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

    let next: GameState = {
        ...s,
        board,
        placed,
        phase,
        current: s.current === 1 ? 2 : 1,
        winner: null
    };

    if (next.phase === 'movement') {
        //  Record the resulting position — covers ordinary moves and the
        //  placement→movement transition (occurrence 1 for that position).
        const key = positionKey(cfg, next);
        const history = { ...(s.history ?? {}) };
        const repeatCount = (history[key] ?? 0) + 1;
        history[key] = repeatCount;
        next = { ...next, history };

        //  trap check runs after EVERY move, including the final placement
        //  (PRD T7): gameover keeps current = trapped player, winner = mover
        if (legalMoves(cfg, next).length === 0) {
            return { ...next, phase: 'gameover', winner: s.current };
        }

        //  threefold repetition draw — gated by cfg.repetitionLimit (opt-in
        //  per mode). A trapping move is a terminal state reached at most
        //  once per game, so its repeatCount is always < repetitionLimit —
        //  win and draw can never fire on the same move; this is safely 2nd.
        if (cfg.repetitionLimit !== undefined && repeatCount >= cfg.repetitionLimit) {
            return { ...next, phase: 'gameover', winner: null };
        }
    }

    return next;
}
```
- **GOTCHA 1**: `s.history ?? {}` is REQUIRED — `history` is optional and `tsconfig.json` has `strict: true`, so reading `s.history[key]` unguarded is a compile error.
- **GOTCHA 2**: history is copied (`{ ...(s.history ?? {}) }`) before writing — never mutate `s.history` in place (breaks T12 + the immutability invariant the whole engine follows).
- **GOTCHA 3**: the win check and draw check are BOTH inside `if (next.phase === 'movement')`, in that order, each with an early `return`. Do not hoist the draw check above the win check or move it outside the guard — a draw can never actually fire before a win in practice (proven: a terminal position occurs at most once per game, so its own count is always < limit), but the ordering is specified and tested (T9) so keep it as written.
- **GOTCHA 4**: `initialState` (below `legalMoves`, unchanged in this task except one line) must also set `history: {}` — see Task 2b.
- **VALIDATE**: `npm run typecheck` (will fail until Task 2b below, since `initialState` doesn't yet set `history` — fine, do both edits together).

### Task 2b: `src/game/engine/rules.ts` — `initialState` sets empty history
- **ACTION**: add `history: {}` to the object `initialState` returns.
- **IMPLEMENT** (the only change — one added line):
```ts
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
- **VALIDATE**: `npm run typecheck` — 0 errors expected now.

### Task 3: `src/game/modes/well/index.ts` — opt in
- **ACTION**: add `repetitionLimit: 3` inside `engine:`.
- **IMPLEMENT** (only the `engine` block changes):
```ts
    engine: {
        pebblesPerPlayer: 2,
        repetitionLimit: 3,
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
```
- **VALIDATE**: `npm run typecheck`

### Task 4: `src/game/engine/__tests__/rules.test.ts` — helper updates + T8–T12
- **ACTION**: (a) add `history: {}` to `makeState`'s defaults, (b) add a `keyOf` test-local helper (independent reimplementation of `positionKey`, NOT imported from rules.ts — this is intentional so a bug in the engine's own key function can't hide behind identical test expectations), (c) append 5 new `describe` blocks.
- **IMPLEMENT — (a) `makeState` change**:
```ts
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
**(b) add near the other test helpers** (after `sortedEdgeKeys`, before the first `describe`):
```ts
const keyOf = (s: GameState) =>
    CFG.board.vertices.map((v) => s.board[v.id] ?? '.').join('') + '|' + s.current;
```
**(c) append these 5 blocks at the end of the file** (after the existing `describe('state integrity', ...)` block):
```ts
describe('T8 draw on threefold repetition', () => {
    it('a 6-ply cycle through C repeating 3x ends the game as a draw', () => {
        //  With one empty vertex, "out and back" in 2 plies is impossible
        //  (the mover's own piece is gone by the time it's their turn
        //  again). The shortest repeating cycle is 6 plies, oscillating C
        //  between both players. Hand-traced and verified against the real
        //  legalMoves/applyMove logic during planning.
        const start = makeState({ board: { C: null, N: 1, E: 1, S: 2, W: 2 } });
        const startKey = keyOf(start);
        let s: GameState = { ...start, history: { [startKey]: 1 } };

        const cycle: Move[] = [
            { kind: 'move', from: 'N', to: 'C' },
            { kind: 'move', from: 'W', to: 'N' },
            { kind: 'move', from: 'C', to: 'W' },
            { kind: 'move', from: 'N', to: 'C' },
            { kind: 'move', from: 'W', to: 'N' },
            { kind: 'move', from: 'C', to: 'W' }
        ];

        for (const move of cycle) {
            s = applyMove(CFG, s, move);
        }
        expect(s.board).toEqual(start.board);
        expect(s.phase).toBe('movement');

        for (const move of cycle) {
            s = applyMove(CFG, s, move);
        }
        expect(s.phase).toBe('gameover');
        expect(s.winner).toBeNull();
    });
});

describe('T9 win is taken even with unrelated repetition counts present', () => {
    it('a trapping move still wins regardless of history contents', () => {
        const s = makeState({
            board: { E: 1, N: 1, S: 2, W: 2, C: null },
            current: 1,
            history: { 'unrelated|2': 5 }
        });
        const next = applyMove(CFG, s, { kind: 'move', from: 'E', to: 'C' });
        expect(next.phase).toBe('gameover');
        expect(next.winner).toBe(1);
    });
});

describe('T10 no false draw across distinct positions', () => {
    it('distinct movement positions never draw while under the limit', () => {
        let s = makeState({ board: { C: null, N: 1, E: 1, S: 2, W: 2 } });
        s = applyMove(CFG, s, { kind: 'move', from: 'N', to: 'C' });
        expect(s.phase).toBe('movement');
        s = applyMove(CFG, s, { kind: 'move', from: 'W', to: 'N' });
        expect(s.phase).toBe('movement');
        s = applyMove(CFG, s, { kind: 'move', from: 'C', to: 'W' });
        expect(s.phase).toBe('movement');
    });
});

describe('T11 repetitionLimit undefined disables the draw check', () => {
    it('the same cycle run 3x never draws when repetitionLimit is unset', () => {
        const noLimitCfg: EngineConfig = { ...CFG, repetitionLimit: undefined };
        let s: GameState = makeState({ board: { C: null, N: 1, E: 1, S: 2, W: 2 } });

        const cycle: Move[] = [
            { kind: 'move', from: 'N', to: 'C' },
            { kind: 'move', from: 'W', to: 'N' },
            { kind: 'move', from: 'C', to: 'W' },
            { kind: 'move', from: 'N', to: 'C' },
            { kind: 'move', from: 'W', to: 'N' },
            { kind: 'move', from: 'C', to: 'W' }
        ];

        for (let round = 0; round < 3; round++) {
            for (const move of cycle) {
                s = applyMove(noLimitCfg, s, move);
            }
        }
        expect(s.phase).toBe('movement');
    });
});

describe('T12 history immutability', () => {
    it('applyMove does not mutate the input history', () => {
        const s = makeState({
            board: { C: null, N: 1, E: 1, S: 2, W: 2 },
            history: { 'x|1': 1 }
        });
        const snapshot = structuredClone(s);
        applyMove(CFG, s, { kind: 'move', from: 'N', to: 'C' });
        expect(s).toEqual(snapshot);
    });
});
```
- **IMPORTS**: add `EngineConfig` to the existing `import type { GameState, Move, PlayerId, VertexId } from '../types';` line (becomes `import type { EngineConfig, GameState, Move, PlayerId, VertexId } from '../types';`).
- **GOTCHA**: T11 MUST spread a fresh config (`{ ...CFG, repetitionLimit: undefined }`) — `CFG` itself now carries `repetitionLimit: 3` after Task 3, so reusing it directly would defeat the test.
- **VALIDATE**: `npm test` — expect 17 (existing) + 5 (new `describe` blocks, 5 `it`s) = 22 tests, all green.

### Task 5: full validation sweep
```bash
npm run typecheck                                         # 0 errors
npm test                                                   # 22/22 green (17 existing unchanged + 5 new)
npm run build                                              # clean
grep -rn "from 'phaser'\|from \"phaser\"" src/game/engine/  # empty — engine purity holds
git diff --stat -- src/game/scenes src/ui                  # empty — zero rendering touched, as planned
```

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| T8 | 6-ply cycle x2 from a seeded start | 1st cycle: movement; 2nd cycle: gameover, winner null | the core feature |
| T9 | trap move + unrelated history entries | gameover, winner = mover | win/draw disjointness |
| T10 | 3 distinct movement positions | all stay movement | no false positive |
| T11 | same cycle x3, `repetitionLimit: undefined` | stays movement throughout | opt-out gate |
| T12 | applyMove with non-empty history | input history unchanged | immutability |

### Edge Cases Checklist
- [x] Repetition exactly at threshold (3rd occurrence) — T8
- [x] Repetition never reached (distinct positions) — T10
- [x] Feature disabled — T11
- [x] Win/draw same-move conflict (proven impossible, tested anyway) — T9
- [x] Mutation safety — T12
- [x] Existing win/trap paths (T1–T7) — regression, unchanged files

---

## Validation Commands
See Task 5. EXPECT: typecheck 0; 22/22 tests; build clean; engine purity grep empty; zero diff in `scenes/`/`ui/`.

## Acceptance Criteria
- [ ] T8–T12 implemented exactly as specified, all green
- [ ] T1–T7 (existing) unchanged and still green
- [ ] `git diff` touches only `types.ts`, `rules.ts`, `modes/well/index.ts`, `rules.test.ts`
- [ ] No `phaser` import anywhere under `engine/`
- [ ] `repetitionLimit`/`history` both optional in their interfaces

## Completion Checklist
- [ ] `positionKey` uses `cfg.board.vertices` fixed order, never `Object.keys`
- [ ] History copied, never mutated
- [ ] Win check strictly before draw check, both inside the movement-phase guard
- [ ] `initialState` seeds `history: {}`
- [ ] `keyOf` in the test file is a SEPARATE reimplementation, not imported from rules.ts

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hand-traced cycle has a transcription typo | L | H (whole task fails) | moves were verified twice (adversarial exhaustive search + manual re-derivation during this planning pass); if T8 fails, log the actual board after each ply and compare against the ply table in the PRD before assuming the engine is wrong |
| Forgetting the `EngineConfig` import in the test file | L | L | typecheck catches immediately |

## Notes
- After validation: commit `feat: add threefold-repetition draw detection`.
- Then run `/ecc:prp-plan .claude/PRPs/prds/draw-by-repetition.prd.md` again for Phase 2 (HUD display) — it depends on this phase being complete.
- Write report to `.claude/PRPs/reports/draw-by-repetition-phase-1-engine-report.md`; flip the PRD's phase-1 row to complete.
