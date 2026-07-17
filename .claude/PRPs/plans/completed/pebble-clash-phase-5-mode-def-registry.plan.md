# Plan: Pebble Clash — Phase 5: Mode Def + Registry

## Summary

Assemble the `clash` `GameModeDef` — the real 37-vertex Sixteen Soldiers board, its 24 lines, `preplaced` (16/16, centre row empty), `boardStrokes`, and engine config (`movement: 'draughts'`, `win: 'elimination'`, `pebblesPerPlayer: 16`) — and register it. Since `MainMenu` renders every entry in `MODES` with zero mode-specific code, registering the mode is what makes "Pebble Clash" appear as a playable button. This is also where the Phase 1 fidelity test (16/16, centre empty, no overlap) that couldn't be written earlier finally lands.

## User Story

As a player, I want "Pebble Clash" to appear in the main menu and, when selected, load a board with all 32 pebbles pre-placed exactly as in the traditional Sixteen Soldiers position, so I can start playing.

## Problem → Solution

`MODES` registry has two entries (`well`, `morris`); no `clash` mode exists. → `modes/clash/index.ts` assembles the full `GameModeDef` from the PRD's already-resolved Board Geometry table; `modes/registry.ts` gains one import + one entry.

## Metadata

- **Complexity**: Medium — zero new logic (pure data transcription), but large data volume (37 vertices, 24 lines, 32 preplaced ids); a typo silently breaks board fidelity.
- **Source PRD**: `.claude/PRPs/prds/pebble-clash.prd.md`
- **PRD Phase**: 5 — "Mode def + registry" (carries residual Phase 1 fidelity-test work)
- **Estimated Files**: 3 (2 CREATE, 1 UPDATE)
- **Depends on**: Phase 3 (rules must support `draughts`/`elimination` for the mode to be playable).

---

## UX Design

### Before
```
┌─────────────────────────────┐
│  Dumb Dumb Man               │
│  [ Pebble Trap ]             │
│  [ Three-in-a-Row ]          │
└─────────────────────────────┘
```

### After
```
┌─────────────────────────────┐
│  Dumb Dumb Man               │
│  [ Pebble Trap ]             │
│  [ Three-in-a-Row ]          │
│  [ Pebble Clash ]            │
└─────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `MainMenu` | 2 buttons | 3 buttons | Zero code change — already iterates `MODES` |
| Selecting "Pebble Clash" | N/A | Loads `BoardScene` with 32 preplaced pebbles in state | Not yet visually rendered — Phase 6 required |

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | `.claude/PRPs/prds/pebble-clash.prd.md` — "Board Geometry" section | THE data source for every id/coordinate/line below. If this plan and the PRD disagree, the PRD is correct. |
| P0 | `src/game/modes/morris/index.ts` | `GameModeDef` shape + header comment convention |
| P0 | `src/game/modes/well/index.ts` | Second example |
| P0 | `src/game/modes/registry.ts` | Registration pattern |
| P1 | `src/game/modes/types.ts` | `GameModeDef`, `Stroke` shapes |

## External Documentation

None.

---

## Patterns to Mirror

### MODE_DEF_SHAPE
```ts
// SOURCE: src/game/modes/morris/index.ts
import type { GameModeDef } from '../types';

//  Mode 2: "Three-in-a-Row" — Three Men's Morris / Tapatan. ...
export const MORRIS_MODE: GameModeDef = {
    id: 'morris',
    name: 'Three-in-a-Row',
    engine: { pebblesPerPlayer: 3, ..., board: { vertices: [...], lines: [...] } },
    boardStrokes: [...]
};
```

### REGISTRY_PATTERN
```ts
// SOURCE: src/game/modes/registry.ts
import type { GameModeDef } from './types';
import { MORRIS_MODE } from './morris';
import { WELL_MODE } from './well';

export const MODES: Record<string, GameModeDef> = {
    [WELL_MODE.id]: WELL_MODE,
    [MORRIS_MODE.id]: MORRIS_MODE
};
```

### STROKE_SHAPE
```ts
// SOURCE: src/game/modes/types.ts
export type Stroke =
    | { kind: 'segment'; from: VertexId; to: VertexId }
    | { kind: 'arc'; cx: number; cy: number; radius: number; startDeg: number; endDeg: number };
```
Every Pebble Clash line is straight — one `segment` stroke per line, `from` = first vertex, `to` = last.

---

## Files to Change

| File | Action |
|---|---|
| `src/game/modes/clash/index.ts` | CREATE — full `GameModeDef` |
| `src/game/modes/registry.ts` | UPDATE — add import + entry |
| `src/game/modes/__tests__/clash-board.test.ts` | CREATE — board fidelity tests |

## NOT Building

- **`BoardScene.create()` seeding pre-placed pebble objects** → Phase 6. Selecting the mode after this phase loads correct `state.board` data, but no pebble circles render yet — `syncPebbles` only fires on a `'place'` move, which preplaced pebbles never generate. **Expected temporary gap.**
- **Jump/chain rendering, highlights** → Phase 6.

---

## Step-by-Step Tasks

### Task 1: Transcribe the board geometry into `clash/index.ts`

Copy verbatim — this is the PRD's Board Geometry table transcribed to TypeScript. Do not hand-recompute coordinates or line membership.

```ts
import type { GameModeDef } from '../types';

//  Mode 3: "Pebble Clash" — traditional Sixteen Soldiers board (5x5
//  Alquerque grid + triangular wing top and bottom). 16 pebbles/side,
//  pre-placed, centre row empty. Jump-to-eliminate, chained captures,
//  flying at <=3 pebbles. See .claude/PRPs/prds/pebble-clash.prd.md
//  "Board Geometry" for the full derivation of every coordinate below.
export const CLASH_MODE: GameModeDef = {
    id: 'clash',
    name: 'Pebble Clash',
    engine: {
        pebblesPerPlayer: 16,
        movement: 'draughts',
        win: 'elimination',
        preplaced: {
            2: [
                'tb0', 'tb1', 'tb2', 'tc0', 'tc1', 'tc2',
                'g00', 'g01', 'g02', 'g03', 'g04',
                'g10', 'g11', 'g12', 'g13', 'g14'
            ],
            1: [
                'bb0', 'bb1', 'bb2', 'bc0', 'bc1', 'bc2',
                'g30', 'g31', 'g32', 'g33', 'g34',
                'g40', 'g41', 'g42', 'g43', 'g44'
            ]
        },
        board: {
            vertices: [
                { id: 'tb0', x: 90, y: 100 }, { id: 'tb1', x: 360, y: 100 }, { id: 'tb2', x: 630, y: 100 },
                { id: 'tc0', x: 225, y: 235 }, { id: 'tc1', x: 360, y: 235 }, { id: 'tc2', x: 495, y: 235 },
                { id: 'g00', x: 90, y: 370 }, { id: 'g01', x: 225, y: 370 }, { id: 'g02', x: 360, y: 370 },
                { id: 'g03', x: 495, y: 370 }, { id: 'g04', x: 630, y: 370 },
                { id: 'g10', x: 90, y: 505 }, { id: 'g11', x: 225, y: 505 }, { id: 'g12', x: 360, y: 505 },
                { id: 'g13', x: 495, y: 505 }, { id: 'g14', x: 630, y: 505 },
                { id: 'g20', x: 90, y: 640 }, { id: 'g21', x: 225, y: 640 }, { id: 'g22', x: 360, y: 640 },
                { id: 'g23', x: 495, y: 640 }, { id: 'g24', x: 630, y: 640 },
                { id: 'g30', x: 90, y: 775 }, { id: 'g31', x: 225, y: 775 }, { id: 'g32', x: 360, y: 775 },
                { id: 'g33', x: 495, y: 775 }, { id: 'g34', x: 630, y: 775 },
                { id: 'g40', x: 90, y: 910 }, { id: 'g41', x: 225, y: 910 }, { id: 'g42', x: 360, y: 910 },
                { id: 'g43', x: 495, y: 910 }, { id: 'g44', x: 630, y: 910 },
                { id: 'bc0', x: 225, y: 1045 }, { id: 'bc1', x: 360, y: 1045 }, { id: 'bc2', x: 495, y: 1045 },
                { id: 'bb0', x: 90, y: 1180 }, { id: 'bb1', x: 360, y: 1180 }, { id: 'bb2', x: 630, y: 1180 }
            ],
            lines: [
                ['g00', 'g01', 'g02', 'g03', 'g04'],
                ['g10', 'g11', 'g12', 'g13', 'g14'],
                ['g20', 'g21', 'g22', 'g23', 'g24'],
                ['g30', 'g31', 'g32', 'g33', 'g34'],
                ['g40', 'g41', 'g42', 'g43', 'g44'],
                ['g00', 'g10', 'g20', 'g30', 'g40'],
                ['g01', 'g11', 'g21', 'g31', 'g41'],
                ['tb1', 'tc1', 'g02', 'g12', 'g22', 'g32', 'g42', 'bc1', 'bb1'],
                ['g03', 'g13', 'g23', 'g33', 'g43'],
                ['g04', 'g14', 'g24', 'g34', 'g44'],
                ['g00', 'g11', 'g22', 'g33', 'g44'],
                ['g04', 'g13', 'g22', 'g31', 'g40'],
                ['g02', 'g11', 'g20'],
                ['g02', 'g13', 'g24'],
                ['g20', 'g31', 'g42'],
                ['g24', 'g33', 'g42'],
                ['tb0', 'tb1', 'tb2'],
                ['tc0', 'tc1', 'tc2'],
                ['tb0', 'tc0', 'g02'],
                ['tb2', 'tc2', 'g02'],
                ['bb0', 'bb1', 'bb2'],
                ['bc0', 'bc1', 'bc2'],
                ['bb0', 'bc0', 'g42'],
                ['bb2', 'bc2', 'g42']
            ]
        }
    },
    //  One straight segment per line — every Pebble Clash line is straight.
    boardStrokes: [
        { kind: 'segment', from: 'g00', to: 'g04' },
        { kind: 'segment', from: 'g10', to: 'g14' },
        { kind: 'segment', from: 'g20', to: 'g24' },
        { kind: 'segment', from: 'g30', to: 'g34' },
        { kind: 'segment', from: 'g40', to: 'g44' },
        { kind: 'segment', from: 'g00', to: 'g40' },
        { kind: 'segment', from: 'g01', to: 'g41' },
        { kind: 'segment', from: 'tb1', to: 'bb1' },
        { kind: 'segment', from: 'g03', to: 'g43' },
        { kind: 'segment', from: 'g04', to: 'g44' },
        { kind: 'segment', from: 'g00', to: 'g44' },
        { kind: 'segment', from: 'g04', to: 'g40' },
        { kind: 'segment', from: 'g02', to: 'g20' },
        { kind: 'segment', from: 'g02', to: 'g24' },
        { kind: 'segment', from: 'g20', to: 'g42' },
        { kind: 'segment', from: 'g24', to: 'g42' },
        { kind: 'segment', from: 'tb0', to: 'tb2' },
        { kind: 'segment', from: 'tc0', to: 'tc2' },
        { kind: 'segment', from: 'tb0', to: 'g02' },
        { kind: 'segment', from: 'tb2', to: 'g02' },
        { kind: 'segment', from: 'bb0', to: 'bb2' },
        { kind: 'segment', from: 'bc0', to: 'bc2' },
        { kind: 'segment', from: 'bb0', to: 'g42' },
        { kind: 'segment', from: 'bb2', to: 'g42' }
    ]
};
```

- **MIRROR**: MODE_DEF_SHAPE, STROKE_SHAPE.
- **GOTCHA (the long vertical line)**: `['tb1', 'tc1', 'g02', 'g12', 'g22', 'g32', 'g42', 'bc1', 'bb1']` has 9 vertices — every other line has 3 or 5. Correct (it threads both wing apexes). Means Phase 3's `line.length === 3` perimeter heuristic does NOT misfire here — only the 4 wing-slant lines and 2 wing-base/crossbar lines are length-3.
- **GOTCHA (`preplaced` key order)**: written `{ 2: [...], 1: [...] }` (player 2 first, matching the vertex list order) — zero behavioural effect, `Record<PlayerId, VertexId[]>` isn't order-sensitive.
- **VALIDATE**: `npm run typecheck` — needs Task 2's registry wiring to fully resolve, but this file typechecks standalone once `Stroke`/`GameModeDef` shapes match.

### Task 2: Register the mode

Edit `src/game/modes/registry.ts`:
```ts
import type { GameModeDef } from './types';
import { CLASH_MODE } from './clash';
import { MORRIS_MODE } from './morris';
import { WELL_MODE } from './well';

export const MODES: Record<string, GameModeDef> = {
    [WELL_MODE.id]: WELL_MODE,
    [MORRIS_MODE.id]: MORRIS_MODE,
    [CLASH_MODE.id]: CLASH_MODE
};
```
- **MIRROR**: REGISTRY_PATTERN, imports alphabetized.
- **GOTCHA**: This is the ONLY integration point — `MainMenu.tsx` needs zero changes (verified: `Object.values(MODES).map((mode) => <button onClick={() => onSelect(mode.id)}>{mode.name}</button>)`).
- **VALIDATE**: `npm run typecheck` green.

### Task 3: Write board fidelity tests (Phase 1 residual work)

Create `src/game/modes/__tests__/clash-board.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { initialState, legalMoves } from '../../engine/rules';
import { CLASH_MODE } from '../clash';
import { MODES } from '../registry';

describe('E1 board fidelity — matches the traditional Sixteen Soldiers position', () => {
    it('has exactly 37 vertices', () => {
        expect(CLASH_MODE.engine.board.vertices).toHaveLength(37);
    });

    it('has exactly 24 lines', () => {
        expect(CLASH_MODE.engine.board.lines).toHaveLength(24);
    });

    it('has no duplicate vertex ids', () => {
        const ids = CLASH_MODE.engine.board.vertices.map((v) => v.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('preplaces exactly 16 pebbles for each player', () => {
        expect(CLASH_MODE.engine.preplaced![1]).toHaveLength(16);
        expect(CLASH_MODE.engine.preplaced![2]).toHaveLength(16);
    });

    it('no vertex is claimed by both players', () => {
        const p1 = new Set(CLASH_MODE.engine.preplaced![1]);
        const overlap = CLASH_MODE.engine.preplaced![2].filter((id) => p1.has(id));
        expect(overlap).toEqual([]);
    });

    it('leaves exactly the 5 centre-row vertices empty', () => {
        const allVertexIds = new Set(CLASH_MODE.engine.board.vertices.map((v) => v.id));
        const occupied = new Set([...CLASH_MODE.engine.preplaced![1], ...CLASH_MODE.engine.preplaced![2]]);
        const empty = [...allVertexIds].filter((id) => !occupied.has(id)).sort();
        expect(empty).toEqual(['g20', 'g21', 'g22', 'g23', 'g24']);
    });

    it('every preplaced/line id refers to a real board vertex', () => {
        const allVertexIds = new Set(CLASH_MODE.engine.board.vertices.map((v) => v.id));
        for (const id of [...CLASH_MODE.engine.preplaced![1], ...CLASH_MODE.engine.preplaced![2]]) {
            expect(allVertexIds.has(id)).toBe(true);
        }
        for (const line of CLASH_MODE.engine.board.lines) {
            for (const id of line) expect(allVertexIds.has(id)).toBe(true);
        }
    });
});

describe('E2 mode registration', () => {
    it('is registered under id "clash"', () => {
        expect(MODES['clash']).toBe(CLASH_MODE);
    });
});

describe('E3 initial state — real board', () => {
    it('seeds 32 pebbles total and opens in movement phase', () => {
        const s = initialState(CLASH_MODE.engine, 'clash');
        expect(s.phase).toBe('movement');
        expect(Object.values(s.board).filter((v) => v !== null)).toHaveLength(32);
    });

    it('every legal opening move is a quiet step — no jumps at turn one', () => {
        //  Both sides are separated by the empty centre row at the opening
        //  position, so no jump should be legal turn one. This is the first
        //  point where Phase 3's rules and Phase 5's real board data run
        //  together — a failure here is almost certainly a board
        //  transcription bug, not a rules bug (rules are already tested).
        const moves = legalMoves(CLASH_MODE.engine, initialState(CLASH_MODE.engine, 'clash'));
        expect(moves.every((m) => m.kind === 'move')).toBe(true);
        expect(moves.length).toBeGreaterThan(0);
    });
});
```
- **MIRROR**: TEST_STRUCTURE, `describe('E<n> ...')` (new prefix — C/D/G taken by earlier phases).
- **GOTCHA**: E3's second test is the real payoff — first point where Phase 3 rules and Phase 5 board data run together. If it fails, suspect the board transcription first.
- **VALIDATE**: `npm test` — all new tests green.

---

## Testing Strategy

| Test | Expected | Edge Case? |
|---|---|---|
| E1: 37 vertices, 24 lines | Exact counts | no |
| E1: no duplicate ids | Set size == array length | **yes** |
| E1: 16/16 preplaced, no overlap | Exact, empty overlap | **yes** |
| E1: centre row empty | Exactly `g20`–`g24` | **yes** |
| E1: all ids resolve | No orphan references | **yes** |
| E2: registered | `MODES['clash'] === CLASH_MODE` | no |
| E3: 32 seeded, movement phase | Matches | no |
| E3: no day-one jumps | All opening moves quiet | **yes — integration** |

---

## Validation Commands

```bash
npm run typecheck
npm test
```
EXPECT: zero errors; all green including ~10 new E-vectors.

### Manual Validation
- [ ] `npm run dev`: menu shows "Pebble Clash" as a third button.
- [ ] Selecting it loads a scene without console errors (pebbles won't be visible yet — expected, Phase 6 fixes rendering).

---

## Acceptance Criteria

- [ ] `CLASH_MODE` exported, matches PRD Board Geometry exactly
- [ ] Registered in `MODES['clash']`
- [ ] "Pebble Clash" appears in `MainMenu` with zero menu code changes
- [ ] E1: 37 vertices, 24 lines, 16/16 preplaced, centre row empty, no dangling references
- [ ] E3: real-board `initialState` yields 32 pebbles, movement phase, only quiet moves at turn one
- [ ] `npm run typecheck` + `npm test` green

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Transcription typo (wrong x/y, wrong line membership) | **M** | E1 catches count/overlap errors; visual hand-check in Phase 6/7 against `docs/pebble-clash-board.png` |
| E3 "no day-one jumps" assumption wrong | L | Treat as a genuine board-data bug report if it fails |

## Notes

**This phase carries Phase 1's original success signal.** The PRD's Phase 1 detail asked for a test asserting "16/16, no overlap, centre empty" — that's `E1` here, relocated to where the real board data lives (Phase 1 itself collapsed into a data table in the PRD).

---

*Next: Phase 6 (scene rendering) — makes the 32 preplaced pebbles (and jumps) actually visible.*
