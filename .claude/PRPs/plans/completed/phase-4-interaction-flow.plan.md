# Plan: Phase 4 — Interaction & Flow (Pebble Trap)

> Written for literal implementation. Every GOTCHA below was verified against
> Phaser docs or a prior phase's actual bug — do not "simplify" around them.

## Summary
Make the game playable: tap-to-place, tap-to-select/move pebbles, legal-move highlights, move tweens, a React HUD (turn indicator + win overlay + restart) driven by the engine via `EventBus`. Zero engine changes — `engine/`, `modes/well/`, `registry.ts` stay frozen; this phase only adds a scene-owned `GameState` and reads it through the existing pure functions.

## User Story
As a player, I want to tap to place and move pebbles and see whose turn it is and who won, so that I can actually play a full game.

## Problem → Solution
Static board with no interaction → full hotseat loop: place → move → trap → win overlay → restart, all engine-driven, with a generic BoardScene (no board-specific constants — same invariant as phase 3).

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/pebble-trap.prd.md`
- **PRD Phase**: 4 — Interaction & flow
- **Estimated Files**: 5 (1 create, 4 update)

---

## UX Design

### Before
Static board, no HUD, nothing happens on tap.

### After
```
┌─────────────────────────┐
│      Red: place pebble  │  <- HUD turn text (React, top ~6%)
│           (1/2)         │
│         .──N──.         │
│       /   |     \       │
│      W────C────E        │  <- board + pebbles (Phaser canvas)
│       \   |              │
│        `──S              │
│                          │
└─────────────────────────┘

On trap:
┌─────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░│  <- semi-transparent overlay (React)
│░░░░░░░░████████░░░░░░░░░│
│░░░░░░░░ Red wins! ░░░░░░│
│░░░░░░░░[Play again]░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Tap empty vertex, placement phase | nothing | places current player's pebble | no-op if occupied |
| Tap own pebble, movement phase | nothing | selects it; ring + legal-destination dots appear | re-tapping a different own pebble re-selects |
| Tap legal destination while selected | nothing | slides pebble there (tweened), deselects, advances turn | |
| Tap anything else while selected | nothing | deselects | opponent pebble, illegal vertex |
| Trap occurs | nothing | HUD overlay shows winner + "Play again" | board taps stop responding |
| Play again | n/a | full reset, P1 to place first | |

---

## Mandatory Reading (in this order)

| Priority | File | Why |
|---|---|---|
| P0 | `.claude/PRPs/prds/pebble-trap.prd.md` — "Win Condition", "Phase 2: Movement", "User Flow", "Success Metrics" | exact rules + the mandated T4/T7 device-replay validation |
| P0 | `src/game/engine/rules.ts`, `src/game/engine/types.ts` | the ONLY functions this phase calls: `initialState`, `legalMoves`, `applyMove` — frozen, read-only |
| P0 | `src/game/scenes/BoardScene.ts` (current, phase-3 state) | file being extended — note it currently computes vertex positions in a LOCAL variable inside `drawBoard()`; this phase hoists that to an instance field (see Task 2) |
| P0 | `src/PhaserGame.tsx` | scene-ready handshake — `currentActiveScene` callback fires with the live scene instance; this is the ONLY reliable way to seed initial UI state (see GOTCHA 4) |
| P1 | `src/game/render/theme.ts` | existing tokens: `pebble`, `pebbleRadius`, `vertexRadius`, `tapRadius`, `moveTweenMs` all already present from phase 1 |
| P1 | `src/game/EventBus.ts` | `new Events.EventEmitter()` from `phaser` — plain pub/sub, same instance used for `current-scene-ready` |
| P2 | `.claude/PRPs/reports/phase-1-scaffold-report.md`, `phase-3-board-render-report.md` — "Deviations" | standing gotchas: no runtime `Phaser` global; browser validation catches what typecheck misses |

## External Documentation

Verified during planning (2026-07-15) — both are easy-to-guess-wrong Phaser input APIs:

| Topic | Source | Key Takeaway |
|---|---|---|
| Interactive hit area on Shape/Arc objects | [Phaser Input docs](https://docs.phaser.io/phaser/concepts/input), [GameObject docs](https://docs.phaser.io/api-documentation/class/gameobjects-gameobject) | Bare `.setInteractive()` tries to build a hit area from a **texture frame**. Arc/Circle/Graphics objects have no texture — this fails. Must pass an explicit `new Phaser.Geom.Circle(...)` + `Phaser.Geom.Circle.Contains`. |
| Hit area coordinate space | Phaser docs + community examples | Hit area coordinates are **local to the object, origin at its top-left**, not world coordinates and not centered-origin-relative. For a centered-origin circle of radius `r`, the correct local hit circle is `new Phaser.Geom.Circle(r, r, r)` — NOT `new Phaser.Geom.Circle(worldX, worldY, r)`. |

GOTCHA (see Task 2 for exact code): getting either of these wrong makes every vertex silently untappable — no error, no console warning, just dead input. This is the phase-4 equivalent of phase 1's `Phaser.Scale` global bug and phase 3's radians footgun — verify with an actual tap in the browser, not just typecheck.

---

## Patterns to Mirror

### SCENE_STATE_OWNERSHIP
BoardScene owns a private `GameState`, mutated only through `applyMove` (never hand-write board mutations). Every call site that changes state goes through one `applyAndSync(move)` helper so pebble-sync, engine update, and the React notification never drift apart.

### EVENT_BRIDGE (existing pattern, phase 1)
// SOURCE: src/PhaserGame.tsx, src/game/scenes/BoardScene.ts (phase 3)
`EventBus.emit('current-scene-ready', this)` stays the LAST line of `create()`. This phase adds a second event, `'game-state-changed'`, emitted by `applyAndSync` and `restartGame` — never inside `create()` (see GOTCHA 4 / Task 2 for why).

### REACT_SCENE_REF_CALL (reconstructed from the template's original demo, read during phase-1 planning before it was deleted)
React calls a public method on the live scene via the existing `phaserRef.current.scene` ref — exactly how the original demo's `changeScene()` button worked. This phase's "Play again" button uses the same shape: `(phaserRef.current?.scene as BoardScene | undefined)?.restartGame()`.

### CODE_STYLE
// SOURCE: src/game/scenes/BoardScene.ts, src/game/engine/rules.ts
4-space indent, single quotes, semicolons. Scene classes: brace-on-own-line. Engine-style files (rules.ts): brace-on-same-line. `Extract<Move, {kind:'move'}>` filter pattern already used in phase 2's test file — reuse it verbatim for `legalDestinations`.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/game/render/theme.ts` | UPDATE | add `highlightColor`, `PLAYER_NAME`, `PLAYER_COLOR_CSS` |
| `src/game/scenes/BoardScene.ts` | UPDATE | own GameState, handle input, tween pebbles, expose `getSnapshot`/`restartGame` |
| `src/ui/Hud.tsx` | CREATE | React turn indicator + win overlay (new `ui/` folder, matches PRD architecture) |
| `public/style.css` | UPDATE | HUD overlay positioning (aspect-locked box mirroring the canvas pillar) |
| `src/App.tsx` | UPDATE | wire scene ref, seed + subscribe to snapshot, render `<Hud>` |

## NOT Building
- Any edit to `engine/*`, `modes/well/*`, `modes/registry.ts` (frozen — grep-verified in Task 6)
- Mode-select menu, "Menu" button on the win overlay (phase 5 — no menu exists yet)
- AI, draw detection, sound, persistence (PRD "Won't Building")
- Sprite assets — pebbles stay procedural circles

---

## Step-by-Step Tasks

### Task 1: theme.ts additions
- **IMPLEMENT** — add to `src/game/render/theme.ts`:
```ts
import type { PlayerId } from '../engine/types';

export const THEME = {
    background: 0x111418,
    boardLine: 0xe8e2d0,
    boardLineWidth: 6,
    vertexDot: 0xe8e2d0,
    pebble: { 1: 0xe53935, 2: 0x1e88e5 },
    pebbleRadius: 34,
    vertexRadius: 12,
    tapRadius: 48,
    moveTweenMs: 200,
    highlightColor: 0xffffff
} as const;

export const PLAYER_NAME: Record<PlayerId, string> = { 1: 'Red', 2: 'Blue' };
export const PLAYER_COLOR_CSS: Record<PlayerId, string> = { 1: '#e53935', 2: '#1e88e5' };
```
(insert the `import` at the top, add `highlightColor` as a new key inside the existing `THEME` object, add the two new exports after it.)
- **GOTCHA**: this makes `render/theme.ts` import an engine TYPE (type-only, erased at compile time). This is allowed — the PRD's only hard rule is "`engine/` imports nothing outside `engine/`"; nothing forbids non-engine files importing engine types. `modes/types.ts` already does this.
- **VALIDATE**: `npm run typecheck`

### Task 2: rewrite `src/game/scenes/BoardScene.ts`
- **IMPLEMENT** (complete file):
```ts
import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { applyMove, initialState, legalMoves } from '../engine/rules';
import type { GameState, Move, VertexId } from '../engine/types';
import { MODES } from '../modes/registry';
import type { GameModeDef } from '../modes/types';
import { THEME } from '../render/theme';

export interface HudSnapshot
{
    game: GameState;
    pebblesPerPlayer: number;
}

interface BoardSceneData
{
    modeId?: string;
}

//  Everything drawn here comes from GameModeDef data (strokes + vertex
//  coords). No board-specific constants may appear in this file — invariant
//  carried over from phase 3.
const degToRad = (deg: number) => (deg * Math.PI) / 180;

export class BoardScene extends Scene
{
    private mode!: GameModeDef;
    private state!: GameState;
    private vertexPos: Record<VertexId, { x: number; y: number }> = {};
    private pebbleObjects: Partial<Record<VertexId, Phaser.GameObjects.Arc>> = {};
    private highlightGraphics!: Phaser.GameObjects.Graphics;
    private selected: VertexId | null = null;
    private legalDestinations: Set<VertexId> = new Set();

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
        this.vertexPos = {};
        for (const v of this.mode.engine.board.vertices)
        {
            this.vertexPos[v.id] = { x: v.x, y: v.y };
        }

        this.drawBoard();
        this.createVertexHitAreas();

        this.highlightGraphics = this.add.graphics();
        this.highlightGraphics.setDepth(2);

        this.pebbleObjects = {};
        this.selected = null;
        this.legalDestinations = new Set();
        this.state = initialState(this.mode.engine, this.mode.id);

        //  NOTE: no 'game-state-changed' emit here on purpose — React seeds
        //  its initial snapshot via getSnapshot() through the scene-ready
        //  callback (see App.tsx), not by racing this event. See GOTCHA 4.
        EventBus.emit('current-scene-ready', this);
    }

    public getSnapshot (): HudSnapshot
    {
        return { game: this.state, pebblesPerPlayer: this.mode.engine.pebblesPerPlayer };
    }

    public restartGame ()
    {
        for (const key of Object.keys(this.pebbleObjects) as VertexId[])
        {
            this.pebbleObjects[key]?.destroy();
        }
        this.pebbleObjects = {};
        this.selected = null;
        this.legalDestinations = new Set();
        this.renderHighlights();
        this.state = initialState(this.mode.engine, this.mode.id);
        EventBus.emit('game-state-changed', this.getSnapshot());
    }

    private drawBoard ()
    {
        const g = this.add.graphics();

        g.lineStyle(THEME.boardLineWidth, THEME.boardLine);
        for (const stroke of this.mode.boardStrokes)
        {
            if (stroke.kind === 'segment')
            {
                const a = this.vertexPos[stroke.from];
                const b = this.vertexPos[stroke.to];
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

    private createVertexHitAreas ()
    {
        for (const v of this.mode.engine.board.vertices)
        {
            const hit = this.add.circle(v.x, v.y, THEME.tapRadius, 0xffffff, 0);
            //  Bare setInteractive() fails on non-texture Shape objects, and
            //  hit-area coords are LOCAL (origin at the object's top-left),
            //  not world coords. For a centered-origin circle of radius r,
            //  the correct local hit circle is (r, r, r). Do not "simplify"
            //  this to setInteractive() or to v.x/v.y — both are silently
            //  untappable. Verified against Phaser input docs 2026-07-15.
            hit.setInteractive(
                new Phaser.Geom.Circle(THEME.tapRadius, THEME.tapRadius, THEME.tapRadius),
                Phaser.Geom.Circle.Contains
            );
            hit.on('pointerdown', () => this.onVertexTap(v.id));
        }
    }

    private onVertexTap (id: VertexId)
    {
        if (this.state.phase === 'gameover')
        {
            return;
        }

        const moves = legalMoves(this.mode.engine, this.state);

        if (this.state.phase === 'placement')
        {
            const legal = moves.some((m) => m.kind === 'place' && m.to === id);
            if (legal)
            {
                this.applyAndSync({ kind: 'place', to: id });
            }
            return;
        }

        if (this.selected !== null)
        {
            const isLegalDest = moves.some(
                (m) => m.kind === 'move' && m.from === this.selected && m.to === id
            );
            if (isLegalDest)
            {
                this.applyAndSync({ kind: 'move', from: this.selected, to: id });
                this.clearSelection();
                return;
            }
        }

        if (this.state.board[id] === this.state.current)
        {
            this.selectVertex(id, moves);
        }
        else
        {
            this.clearSelection();
        }
    }

    private selectVertex (id: VertexId, moves: Move[])
    {
        this.selected = id;
        this.legalDestinations = new Set(
            moves
                .filter((m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.from === id)
                .map((m) => m.to)
        );
        this.renderHighlights();
    }

    private clearSelection ()
    {
        this.selected = null;
        this.legalDestinations = new Set();
        this.renderHighlights();
    }

    //  Must run BEFORE this.state is reassigned in applyAndSync: it reads
    //  this.state.current for the mover's color/identity, and for a 'move'
    //  it looks up the pebble object still sitting at `from`.
    private syncPebbles (move: Move)
    {
        const player = this.state.current;
        if (move.kind === 'place')
        {
            const pos = this.vertexPos[move.to];
            const circle = this.add.circle(pos.x, pos.y, THEME.pebbleRadius, THEME.pebble[player]);
            circle.setDepth(1);
            this.pebbleObjects[move.to] = circle;
            return;
        }

        const circle = this.pebbleObjects[move.from];
        delete this.pebbleObjects[move.from];
        if (!circle)
        {
            return;
        }
        this.pebbleObjects[move.to] = circle;
        const dest = this.vertexPos[move.to];
        this.tweens.add({
            targets: circle,
            x: dest.x,
            y: dest.y,
            duration: THEME.moveTweenMs,
            ease: 'Quad.easeInOut'
        });
    }

    private applyAndSync (move: Move)
    {
        this.syncPebbles(move);
        this.state = applyMove(this.mode.engine, this.state, move);
        EventBus.emit('game-state-changed', this.getSnapshot());
    }

    private renderHighlights ()
    {
        this.highlightGraphics.clear();
        if (this.selected === null)
        {
            return;
        }

        const pos = this.vertexPos[this.selected];
        this.highlightGraphics.lineStyle(4, THEME.highlightColor, 0.9);
        this.highlightGraphics.strokeCircle(pos.x, pos.y, THEME.pebbleRadius + 8);

        this.highlightGraphics.fillStyle(THEME.highlightColor, 0.35);
        for (const dest of this.legalDestinations)
        {
            const d = this.vertexPos[dest];
            this.highlightGraphics.fillCircle(d.x, d.y, THEME.vertexRadius + 6);
        }
    }
}
```
- **GOTCHA 1** (hit areas): see inline comment above — verified against Phaser docs, do not alter.
- **GOTCHA 2** (no Phaser global): `degToRad` stays a local helper (carried from phase 3) — no runtime `Phaser` global exists in this ESM build.
- **GOTCHA 3** (ordering in `applyAndSync`): `syncPebbles(move)` MUST run before `this.state = applyMove(...)` — it depends on the pre-move `this.state.current` and `this.state.board`.
- **GOTCHA 4** (no initial `game-state-changed` emit in `create()`): Phaser boots asynchronously; relying on React's `EventBus.on` being attached before the FIRST emit is a timing assumption, not a guarantee. Instead, `create()` only emits `current-scene-ready` — React seeds its initial snapshot by calling `getSnapshot()` on the scene it receives from that ALREADY-PROVEN-SAFE handshake (used since phase 1). All SUBSEQUENT updates (after any place/move/restart) go through `game-state-changed`, which is safe because by then React has long since mounted.
- **GOTCHA 5** (depth): `highlightGraphics` (depth 2) must render above pebbles (depth 1) — pebbles are created dynamically DURING play, after `highlightGraphics` already exists, so without explicit depth the newest pebble would visually sit on top of an older selection ring. Hit-area circles need no depth tuning — they are the only interactive objects at their position (pebbles are never made interactive), so there is no input-priority ambiguity to resolve.
- **VALIDATE**: `npm run typecheck && npm test` (17/17 must stay green — no engine code touched).

### Task 3: `src/ui/Hud.tsx` (new folder)
- **IMPLEMENT** (complete file):
```tsx
import { PLAYER_COLOR_CSS, PLAYER_NAME } from '../game/render/theme';
import type { HudSnapshot } from '../game/scenes/BoardScene';

interface HudProps
{
    snapshot: HudSnapshot | null;
    onRestart: () => void;
}

function turnText (snapshot: HudSnapshot): string
{
    const { game, pebblesPerPlayer } = snapshot;
    const name = PLAYER_NAME[game.current];
    if (game.phase === 'placement')
    {
        const n = game.placed[game.current] + 1;
        return `${name}: place pebble (${n}/${pebblesPerPlayer})`;
    }
    return `${name}: move a pebble`;
}

export function Hud ({ snapshot, onRestart }: HudProps)
{
    if (!snapshot)
    {
        return null;
    }

    const { game } = snapshot;
    const isOver = game.phase === 'gameover';

    return (
        <div id="hud-layer">
            <div id="hud-box">
                {!isOver && (
                    <div className="hud-turn" style={{ color: PLAYER_COLOR_CSS[game.current] }}>
                        {turnText(snapshot)}
                    </div>
                )}
                {isOver && game.winner !== null && (
                    <div className="hud-overlay">
                        <div className="hud-overlay-text" style={{ color: PLAYER_COLOR_CSS[game.winner] }}>
                            {PLAYER_NAME[game.winner]} wins!
                        </div>
                        <button type="button" className="hud-button" onClick={onRestart}>
                            Play again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
```
- **GOTCHA**: `game.winner !== null` guard is required — `winner: PlayerId | null` per engine types, and `PLAYER_NAME`/`PLAYER_COLOR_CSS` are indexed by `PlayerId` (1 | 2), not `PlayerId | null`.
- **VALIDATE**: `npm run typecheck`

### Task 4: `public/style.css` additions
- **IMPLEMENT** — append to `public/style.css`:
```css
#hud-layer {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
}

#hud-box {
    position: relative;
    height: 100%;
    aspect-ratio: 9 / 16;
    max-width: 100%;
    color: #e8e2d0;
}

.hud-turn {
    position: absolute;
    top: 6%;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 1.5rem;
    font-weight: 600;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
}

.hud-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    background: rgba(17, 20, 24, 0.75);
    pointer-events: auto;
}

.hud-overlay-text {
    font-size: 2rem;
    font-weight: 700;
}

.hud-button {
    padding: 12px 28px;
    font-size: 1.1rem;
    background: #e8e2d0;
    color: #111418;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

.hud-button:hover {
    background: #ffffff;
}
```
- **GOTCHA**: `#hud-layer` has `pointer-events: none` so board taps pass through to the canvas underneath — only `.hud-overlay` (the win screen) re-enables `pointer-events: auto` for its "Play again" button. Do not add `pointer-events: auto` anywhere else or board taps will stop registering.
- **GOTCHA**: `#hud-box` mirrors the SAME 9:16 fit-and-center concept as `game/main.ts`'s `Scale.FIT` (height-first with a width cap) so the turn text/overlay visually align with the canvas pillar at any window size. This is a CSS-only echo of that logic, not a shared code path — verify alignment in the browser step below, at both a wide and a narrow window (mirrors phase 1's two-orientation check).
- **VALIDATE**: visual only, checked in Task 6.

### Task 5: rewrite `src/App.tsx`
- **IMPLEMENT** (complete file):
```tsx
import { useEffect, useRef, useState } from 'react';
import { EventBus } from './game/EventBus';
import type { BoardScene, HudSnapshot } from './game/scenes/BoardScene';
import type { IRefPhaserGame } from './PhaserGame';
import { PhaserGame } from './PhaserGame';
import { Hud } from './ui/Hud';

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null);

    const currentScene = (scene: Phaser.Scene) =>
    {
        const board = scene as BoardScene;
        setSnapshot(board.getSnapshot());
    };

    useEffect(() =>
    {
        EventBus.on('game-state-changed', setSnapshot);
        return () =>
        {
            EventBus.removeListener('game-state-changed');
        };
    }, []);

    const restart = () =>
    {
        const board = phaserRef.current?.scene as BoardScene | undefined;
        board?.restartGame();
    };

    return (
        <>
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            <Hud snapshot={snapshot} onRestart={restart} />
        </>
    );
}

export default App
```
- **MIRROR**: `currentScene` callback shape is IDENTICAL to the template's original demo pattern (read during phase-1 planning) — a function matching `(scene: Phaser.Scene) => void`, cast to the concrete scene type, calling a method on it.
- **GOTCHA**: `EventBus.removeListener('game-state-changed')` with no handler argument mirrors the EXISTING style in `PhaserGame.tsx`'s cleanup for `'current-scene-ready'`. Safe here because this is the only place that registers a listener for `'game-state-changed'` and the effect has empty deps (`[]`) — one registration, one matching cleanup on unmount.
- **VALIDATE**: `npm run typecheck && npm test`

### Task 6: validation sweep
```bash
npm run typecheck        # 0 errors
npm test                 # 17/17 still green — engine untouched
npm run build             # clean
git diff --stat -- src/game/engine src/game/modes/well src/game/modes/registry.ts   # MUST be empty — frozen this phase too
npm run dev               # then browser-validate below
```

Browser validation (REQUIRED — this is the most interaction-heavy phase yet):

1. Open a fresh tab (cache-busted URL) at http://localhost:8080. Console must show zero errors.
2. **Placement phase**: tap N — red pebble appears, HUD reads "Red: place pebble (2/2)". Tap N again (occupied) — nothing happens. Tap S — blue pebble appears, HUD reads "Blue: place pebble (2/2)". Tap C — red. Tap W — blue. Board now: `{N:1, S:2, C:1, W:2, E:null}`. HUD should now read "Red: move a pebble" (movement phase; this exact position is NOT a trap — Red holds C, adjacent to empty E).
3. **T4 replay** (PRD-mandated device check): from the position above, tap C to select it (ring + legal-dest dot at E should appear), tap E — pebble tweens C→E over ~200ms. This traps Blue (S,W both non-adjacent to the new empty C). HUD must switch to the win overlay: "Red wins!" in red text, "Play again" button. Tapping the board must now do nothing (gameover guard).
4. Click "Play again" — board clears, all pebble objects gone, HUD returns to "Red: place pebble (1/2)".
5. **T7 replay** (PRD-mandated placement-trap check): place in order S(red), C(blue), W(red), N(blue). The 4th tap (N) must IMMEDIATELY show the win overlay — "Blue wins!" — with no movement phase in between (validates the placement→gameover transition, not just movement→gameover). Verify a 5th tap anywhere does nothing.
6. Click "Play again" again — confirm second reset also works cleanly (no leftover pebble objects, no leftover highlight ring).
7. **Selection UX**: start a fresh game, place all 4 non-trapping (e.g. C,N,W,S), enter movement. Select a pebble (ring appears), tap a different own pebble — selection moves to it (no move applied). Tap an opponent's pebble or empty non-legal vertex — selection clears (ring disappears).
8. Resize to a narrow viewport (or use device emulation, 390×844) — confirm HUD turn text and win overlay stay visually aligned with the canvas pillar, matching phase 1's two-orientation portrait check.

---

## Testing Strategy
No new unit tests — this phase is UI/interaction wiring over an already-tested engine (17 tests from phase 2 are the regression gate). The browser script in Task 6 IS the functional test, and it directly replays the PRD's own mandated Success Metric ("replay T7 placement sequence + T4 position on device").

## Acceptance Criteria
- [ ] Full game playable start to finish via tapping alone (no console access needed)
- [ ] T4 and T7 sequences reproduce gameover exactly as specified, including the placement-phase trap (T7)
- [ ] Restart fully resets — verified twice in a row
- [ ] Selection highlights show/hide correctly per the PRD's tap-elsewhere-deselects rule
- [ ] Move tween visibly animates (~200ms, not instant)
- [ ] `git diff` on `engine/`, `modes/well/`, `modes/registry.ts` is empty — untouched this phase
- [ ] 17/17 engine tests still green, typecheck 0, build clean
- [ ] Zero console errors through the entire scripted playthrough

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hit area wrong (world coords or bare setInteractive) | M (easy mistake, verified in this plan) | H — game fully untappable, no error | GOTCHA 1 with verified-correct code; step 2 of browser validation catches it immediately |
| React/Phaser state drift (stale HUD) | L | M | single `applyAndSync` choke point; snapshot seeded via proven scene-ready handshake, not a race |
| CSS aspect-box misaligned with canvas at extreme sizes | L | L (cosmetic only, taps unaffected since positioning ≠ hit-testing — hit areas are in canvas/world space, untouched by HUD CSS) | step 8 of browser validation |
| Phaser 4 Graphics `strokeCircle` behaves differently than `fillCircle` (only `fillCircle` was browser-proven in phase 3) | L | L | step 3 of browser validation explicitly checks the selection ring renders |

## Notes
- After validation: commit as `feat: wire tap interaction, HUD, and win flow` (conventional commit).
- Phase 5 (Shell & polish) becomes the next pending PRD phase — mode-select menu via `MODES` registry, "Menu" button on the win overlay, asset manifest stub. `App.tsx`'s scene-ref plumbing from this phase is reusable as-is.
- If browser validation surfaces a Phaser input quirk NOT covered by the two verified GOTCHAs above (e.g. hit areas not scaling correctly under `Scale.FIT`), that is a genuine unknown worth escalating rather than guessing around — everything else in this plan was verified against docs or prior-phase precedent.
