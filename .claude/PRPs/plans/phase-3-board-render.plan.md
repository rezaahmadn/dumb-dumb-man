# Plan: Phase 3 — Board Render (Pebble Trap)

> Written for implementation by a smaller model. Follow literally. When a GOTCHA
> conflicts with your instinct, the GOTCHA wins — each one is a bug already hit
> and fixed in phases 1–2.

## Summary
Replace BoardScene's placeholder text with the actual well board, drawn 100% from `WELL_MODE` data (strokes + vertex coords). Static render only — no input, no pebbles, no HUD (phase 4). Success = board matches the hand drawing: circle + cross, gap at bottom-right, 5 vertex dots.

## User Story
As a player, I want to see the game board, so that the space I'll play in is visible and matches the designed layout.

## Problem → Solution
Placeholder text on empty canvas → data-driven board drawing; scene stays generic (new mode = new data, zero scene edits).

## Metadata
- **Complexity**: Small
- **Source PRD**: `.claude/PRPs/prds/pebble-trap.prd.md`
- **PRD Phase**: 3 — Board render
- **Estimated Files**: 2 (both UPDATE)

---

## UX Design

### Before
Dark portrait canvas, centered text "Pebble Trap (board arrives in phase 3)".

### After
```
   Dark canvas (720×1280 design space)
        .───N───.
      /     │     \
     │      │      │
     W──────C──────E      cream lines (#e8e2d0), width 6
      \     │             5 filled dots at C,N,E,S,W
        `───S             bottom-right arc ABSENT (the "well")
```

### Interaction Changes
None — static render. Input arrives in phase 4.

---

## Mandatory Reading (in this order)

| Priority | File | Why |
|---|---|---|
| P0 | `.claude/PRPs/reports/phase-1-scaffold-report.md` — "Deviations" section | standing gotchas: NO global `Phaser` at runtime; Phaser owns centering |
| P0 | `src/game/modes/well/index.ts` | the data you render — do NOT modify it |
| P0 | `src/game/scenes/BoardScene.ts` | file you replace |
| P1 | `src/game/render/theme.ts` | colors/sizes — you add one field |
| P1 | `src/game/modes/types.ts` | `Stroke` union you consume |
| P2 | `.claude/PRPs/prds/pebble-trap.prd.md` — "Board rendering" | normative arc semantics |

## External Documentation
None needed. Everything below is complete.

---

## Patterns to Mirror

### NO_PHASER_GLOBAL (phase-1 bug — repeats easily HERE)
Phaser 4 ESM sets NO global `Phaser`. `Phaser.Math.DegToRad(...)` CRASHES at runtime while passing typecheck. This plan uses a local `degToRad` helper instead — keep it. Only `Phaser.Types.*` in TYPE positions is safe.

### SCENE_SHAPE
// SOURCE: src/game/scenes/BoardScene.ts (current)
Class extends `Scene`, string key in constructor, `EventBus.emit('current-scene-ready', this)` as the LAST line of `create()` — mandatory, or the React bridge never receives the scene.

### CODE_STYLE
4-space indent, single quotes, semicolons, brace-on-own-line in scene classes (match existing scene files).

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/game/render/theme.ts` | UPDATE | add `boardLineWidth` |
| `src/game/scenes/BoardScene.ts` | UPDATE | placeholder → data-driven board render |

## NOT Building
- Pebbles, taps, selection, HUD, win overlay (phase 4)
- Menu / mode select (phase 5)
- Any change to `modes/well/index.ts`, `engine/*`, `registry.ts` (frozen)
- Sprite/image assets — procedural Graphics only

---

## Step-by-Step Tasks

### Task 1: add line width to theme
- **ACTION**: in `src/game/render/theme.ts`, add one field to THEME:
```ts
    boardLineWidth: 6,
```
(place after `boardLine`; keep `as const`.)
- **VALIDATE**: `npm run typecheck`

### Task 2: rewrite `src/game/scenes/BoardScene.ts`
- **IMPLEMENT** (complete file — use exactly this):
```ts
import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import type { VertexId } from '../engine/types';
import { MODES } from '../modes/registry';
import type { GameModeDef } from '../modes/types';
import { THEME } from '../render/theme';

interface BoardSceneData
{
    modeId?: string;
}

//  Everything drawn here comes from GameModeDef data (strokes + vertex
//  coords). No board-specific constants may appear in this file — that is
//  the PRD phase-3 success signal.
const degToRad = (deg: number) => (deg * Math.PI) / 180;

export class BoardScene extends Scene
{
    private mode!: GameModeDef;

    constructor ()
    {
        super('BoardScene');
    }

    init (data: BoardSceneData)
    {
        const modeId = data.modeId ?? 'well';
        const mode = MODES[modeId];
        if (!mode)
        {
            throw new Error(`unknown mode: ${modeId}`);
        }
        this.mode = mode;
    }

    create ()
    {
        this.drawBoard();

        EventBus.emit('current-scene-ready', this);
    }

    private drawBoard ()
    {
        const g = this.add.graphics();
        const pos: Record<VertexId, { x: number; y: number }> = {};
        for (const v of this.mode.engine.board.vertices)
        {
            pos[v.id] = { x: v.x, y: v.y };
        }

        g.lineStyle(THEME.boardLineWidth, THEME.boardLine);
        for (const stroke of this.mode.boardStrokes)
        {
            if (stroke.kind === 'segment')
            {
                const a = pos[stroke.from];
                const b = pos[stroke.to];
                g.lineBetween(a.x, a.y, b.x, b.y);
            }
            else
            {
                g.beginPath();
                g.arc(
                    stroke.cx,
                    stroke.cy,
                    stroke.radius,
                    degToRad(stroke.startDeg),
                    degToRad(stroke.endDeg),
                    false
                );
                g.strokePath();
            }
        }

        for (const v of this.mode.engine.board.vertices)
        {
            g.fillStyle(THEME.vertexDot);
            g.fillCircle(v.x, v.y, THEME.vertexRadius);
        }
    }
}
```
- **GOTCHA 1**: `degToRad` is a LOCAL helper on purpose. Do NOT replace with `Phaser.Math.DegToRad` — no runtime global (phase-1 bug). Do NOT import `Math` from 'phaser' either (shadows global `Math`).
- **GOTCHA 2**: arc `anticlockwise` arg is `false` — 90°→360° clockwise passes S→W→N→E leaving the bottom-right (S–E) quadrant open. If your render shows the gap anywhere else, you flipped a sign — do not "fix" the data.
- **GOTCHA 3**: `beginPath()` before `arc()`, `strokePath()` after — otherwise the arc connects to previous drawing or doesn't appear.
- **GOTCHA 4**: keep the `EventBus.emit('current-scene-ready', this)` line LAST in `create()`.
- **VALIDATE**: `npm run typecheck && npm test` (all 17 tests must stay green — you touched no engine code).

### Task 3: validation sweep
```bash
npm run typecheck        # 0 errors
npm test                 # 17/17 still green
npm run build            # clean
grep -n "360\|560\|270\|290\|830\|630" src/game/scenes/BoardScene.ts   # MUST be empty — no magic coords
npm run dev              # then browser-validate (below)
```
Browser validation (REQUIRED — phases 1–2 proved typecheck misses runtime bugs):
1. Open http://localhost:8080 (fresh tab, not a hot-reloaded one — Phaser doesn't re-create on HMR).
2. Expect: portrait pillar; cream circle+cross on dark bg; vertical line N→S, horizontal W→E, crossing at center; circle arc open ONLY at bottom-right; 5 dots at center + 4 line ends.
3. Console: zero errors (`Phaser is not defined` here means GOTCHA 1 violated).
4. Compare with the hand drawing in the PRD "Board" section — same topology.
5. Data-driven proof (PRD success signal): temporarily change `radius: 270` to `200` in `modes/well/index.ts`, reload → circle shrinks; REVERT it, reload, confirm restored.

---

## Testing Strategy
No new unit tests — rendering phase. Existing 17 engine tests must stay green (regression only). The browser checklist above is the test.

## Acceptance Criteria
- [ ] Board matches drawing: cross + circle, S–E gap bottom-right, 5 dots
- [ ] Zero console errors on fresh load
- [ ] `grep` for magic coords in BoardScene.ts empty
- [ ] 17/17 tests green, typecheck 0, build clean
- [ ] Radius-change experiment moves rendering (then reverted — `git status` shows only theme.ts + BoardScene.ts changed)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phaser global regression | M (habit) | H | GOTCHA 1; console check catches instantly |
| Arc direction flipped | L | M | GOTCHA 2 + visual compare with drawing |
| Phaser 4 Graphics.arc quirk | L | M | fallback documented in PRD: pin `phaser@^3.90`; escalate to bigger model only if arc genuinely broken in v4 |

## Notes
- After validation: commit as `feat: render well board from mode data` (conventional commit, one line fine).
- Then run `/ecc:prp-plan .claude/PRPs/prds/pebble-trap.prd.md` for phase 4 — or hand back to the bigger model if you want plan authorship escalated (phase 4 = input state machine, trickiest remaining).
- PRD row 3: flip to `complete` + add report link, mirroring rows 1–2. Write report to `.claude/PRPs/reports/phase-3-board-render-report.md` following the phase-2 report's structure.
