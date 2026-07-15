# Plan: Phase 5 — Shell & Polish (Pebble Trap)

> Final phase. Goal is not more game — it's PROVING the multi-mode hypothesis
> (Key Hypothesis in the PRD): a new mode = new registry entry, zero scene/engine
> edits. Menu is React (per PRD architecture). GOTCHAs carry the accumulated
> lessons: no bare `Phaser.` runtime refs (phases 1/3/4), browser-validate.

## Summary
Add a React main menu that lists the `MODES` registry and starts the chosen mode; thread `modeId` React→Phaser via the game registry; add "Menu" navigation (win overlay + during play) so the menu↔game↔win loop closes; drop an asset-manifest stub establishing the sprite seam. Prove genericity by temporarily adding a fake 2nd registry entry, confirming the menu lists it and it plays, with ZERO edits to `BoardScene`/`engine`, then reverting.

## User Story
As a player, I want a menu to pick a mode and a way back to it after a game, so the app feels complete; as the developer, I want adding a mode to be pure data.

## Problem → Solution
Game boots straight into 'well' with no menu and no exit → menu-first shell that is generic over `MODES`, with full menu → game → win → menu navigation.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/pebble-trap.prd.md`
- **PRD Phase**: 5 — Shell & polish
- **Estimated Files**: 9 (2 create, 7 update)

---

## UX Design

### Before
App boots directly to the well board (well is hardcoded default). No menu, no way out of a game except finishing it.

### After
```
MENU                         GAME                         WIN
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│  Pebble Trap  │           │ Menu   Red:.. │           │░░░░░░░░░░░░░░░│
│               │  select   │      N        │   trap    │░ Blue wins! ░│
│ ┌───────────┐ │  ───────> │   W  C  E     │  ───────> │░[Play again]░│
│ │Well Board │ │           │      S        │           │░  [ Menu ]  ░│
│ └───────────┘ │  <─────────────── Menu ───────────────│░░░░░░░░░░░░░░░│
│  (one per     │                                        └───────────────┘
│   MODES entry)│
└───────────────┘
```

### Interaction Changes
| Touchpoint | Before | After |
|---|---|---|
| App launch | well board | menu listing every `MODES` entry |
| Tap a mode | n/a | starts that mode's board |
| "Menu" (top-left, during play) | n/a | back to menu (also the escape hatch for infinite games) |
| Win overlay | [Play again] | [Play again] [Menu] |

---

## Mandatory Reading
| Priority | File | Why |
|---|---|---|
| P0 | `.claude/PRPs/prds/pebble-trap.prd.md` — "Key Hypothesis", "Phase 5", "User Flow" | the genericity claim this phase proves |
| P0 | `src/App.tsx`, `src/ui/Hud.tsx` (phase-4 state) | screen wiring + HUD extended here |
| P0 | `src/PhaserGame.tsx`, `src/game/main.ts`, `src/game/scenes/Boot.ts` | modeId thread: prop → StartGame → registry → Boot → BoardScene.init (already reads `data.modeId`) |
| P1 | `src/game/modes/registry.ts`, `src/game/modes/well/index.ts` | menu maps over `MODES`; fake-2nd-entry test target |
| P1 | `src/game/render/theme.ts`, `public/style.css` | styling |
| P2 | `.claude/PRPs/reports/phase-4-interaction-flow-report.md` — Deviations | standing gotcha: grep `Phaser\.` for runtime refs before done |

## External Documentation
| Topic | Source | Takeaway |
|---|---|---|
| Pass data to first scene | [Phaser Data Manager docs](https://docs.phaser.io/phaser/concepts/data-manager) | No config path to first scene's init; use `game.registry.set(...)` right after `new Game()` (synchronous, lands before the deferred Boot.create) — all scenes read `this.registry`. |

---

## Patterns to Mirror
### SCREEN_DISCRIMINATOR
`App` uses `modeId: string | null` as the single screen state: `null` = menu, a string = play that mode. No separate `screen` enum needed.

### MOUNT_UNMOUNT_LIFECYCLE
`PhaserGame` is conditionally rendered ONLY in the game screen. Going to menu unmounts it → the template's existing cleanup `game.destroy(true)` fires → fresh game on next mount. This is why each game starts clean without extra reset code.

### NO_PHASER_GLOBAL (phases 1/3/4)
Zero bare `Phaser.` runtime references. Type positions (`Phaser.Scene`, `Phaser.Game`) are fine. This phase adds no new Phaser value calls, but grep anyway (Task 9).

### EVENT_BRIDGE (unchanged)
`game-state-changed` subscription stays in App's mount effect. Fresh game's `create()` re-emits `current-scene-ready` → `currentScene` re-seeds snapshot. `toMenu`/`startMode` null the snapshot so no stale HUD flashes.

---

## Files to Change
| File | Action | Justification |
|---|---|---|
| `src/ui/MainMenu.tsx` | CREATE | React menu over `MODES` |
| `src/game/render/assets.ts` | CREATE | asset-manifest stub (PRD file layout) |
| `src/App.tsx` | UPDATE | screen state, menu/back wiring, thread modeId |
| `src/PhaserGame.tsx` | UPDATE | accept `modeId` prop, pass to StartGame |
| `src/game/main.ts` | UPDATE | `StartGame(parent, modeId)` stashes modeId in registry |
| `src/game/scenes/Boot.ts` | UPDATE | read modeId from registry, start BoardScene with it |
| `src/ui/Hud.tsx` | UPDATE | `onMenu`; [Play again][Menu] overlay; during-play Menu button |
| `public/style.css` | UPDATE | menu + menu-button + overlay-actions styles |

## NOT Building
- Real modes 2/3 (PRD "Won't") — genericity proven with a TEMPORARY fake entry, reverted
- Actual sprite assets — `assets.ts` is a documented seam, not wired into rendering
- Sound, persistence, settings
- Any change to `engine/*` or `BoardScene`'s drawing/rules — proving they need none IS the deliverable

---

## Step-by-Step Tasks

### Task 1: `src/game/render/assets.ts` (new)
```ts
import type { PlayerId } from '../engine/types';

//  Asset manifest seam. v1 draws pebbles/board procedurally (see BoardScene).
//  When sprite art arrives, map keys to image paths here and have BoardScene
//  prefer a loaded texture over a drawn shape. Nothing consumes this yet — it
//  exists so that adding assets is a data change, not a scene rewrite.
export interface AssetManifest {
    pebbles?: Partial<Record<PlayerId, string>>; // player -> image path under public/assets
}

export const ASSETS: AssetManifest = {};

export function pebbleSprite(player: PlayerId): string | undefined {
    return ASSETS.pebbles?.[player];
}
```
- **VALIDATE**: `npm run typecheck`

### Task 2: `src/game/main.ts` — thread modeId
Change StartGame to:
```ts
const StartGame = (parent: string, modeId = 'well') => {

    const game = new Game({ ...config, parent });
    game.registry.set('modeId', modeId);
    return game;

}
```
(keep imports/config unchanged.)
- **GOTCHA**: `game.registry.set` is synchronous and runs before Phaser's deferred boot, so Boot.create sees it. No `Phaser.` value refs added.
- **VALIDATE**: `npm run typecheck`

### Task 3: `src/game/scenes/Boot.ts` — read modeId
```ts
import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    create ()
    {
        const modeId = (this.registry.get('modeId') as string | undefined) ?? 'well';
        this.scene.start('BoardScene', { modeId });
    }
}
```
- **VALIDATE**: `npm run typecheck`

### Task 4: `src/PhaserGame.tsx` — accept modeId prop
Add `modeId?: string` to `IProps`; pass to StartGame at creation:
```ts
game.current = StartGame("game-container", modeId);
```
Leave everything else (the null-guard, EventBus effect, cleanup) untouched. Effect dep array stays `[ref]` — PhaserGame mounts fresh per game with a stable modeId, so capturing it at creation is correct.
- **GOTCHA**: do NOT add modeId to the effect deps — it would destroy/recreate the game on unrelated re-renders. modeId is constant for the life of a mount (changing modes routes through the menu, which unmounts).
- **VALIDATE**: `npm run typecheck`

### Task 5: `src/ui/MainMenu.tsx` (new)
```tsx
import { MODES } from '../game/modes/registry';

interface MainMenuProps
{
    onSelect: (modeId: string) => void;
}

export function MainMenu ({ onSelect }: MainMenuProps)
{
    const modes = Object.values(MODES);

    return (
        <div id="menu-layer">
            <div id="menu-box">
                <h1 className="menu-title">Pebble Trap</h1>
                <div className="menu-modes">
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            className="menu-mode-button"
                            onClick={() => onSelect(mode.id)}
                        >
                            {mode.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
```
- **GOTCHA**: iterate `Object.values(MODES)` — do NOT hardcode "Well Board". That's the whole genericity point; a hardcoded list fails the fake-2nd-entry test.
- **VALIDATE**: `npm run typecheck`

### Task 6: `src/ui/Hud.tsx` — add Menu navigation
Add `onMenu: () => void` to `HudProps`. Render a during-play "Menu" button (top-left) and, on gameover, a two-button row [Play again][Menu]:
```tsx
import { PLAYER_COLOR_CSS, PLAYER_NAME } from '../game/render/theme';
import type { HudSnapshot } from '../game/scenes/BoardScene';

interface HudProps
{
    snapshot: HudSnapshot | null;
    onRestart: () => void;
    onMenu: () => void;
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

export function Hud ({ snapshot, onRestart, onMenu }: HudProps)
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
                <button type="button" className="hud-menu-button" onClick={onMenu}>
                    Menu
                </button>
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
                        <div className="hud-overlay-actions">
                            <button type="button" className="hud-button" onClick={onRestart}>
                                Play again
                            </button>
                            <button type="button" className="hud-button hud-button-secondary" onClick={onMenu}>
                                Menu
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
```
- **GOTCHA**: `.hud-menu-button` sits in `#hud-layer` (pointer-events: none) so it MUST set `pointer-events: auto` in CSS (Task 8), else it's unclickable. Same reason the overlay already does.
- **VALIDATE**: `npm run typecheck`

### Task 7: `src/App.tsx` — screen state + wiring
```tsx
import { useEffect, useRef, useState } from 'react';
import { EventBus } from './game/EventBus';
import type { BoardScene, HudSnapshot } from './game/scenes/BoardScene';
import type { IRefPhaserGame } from './PhaserGame';
import { PhaserGame } from './PhaserGame';
import { Hud } from './ui/Hud';
import { MainMenu } from './ui/MainMenu';

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [modeId, setModeId] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null);

    useEffect(() =>
    {
        EventBus.on('game-state-changed', setSnapshot);
        return () =>
        {
            EventBus.removeListener('game-state-changed');
        };
    }, []);

    const currentScene = (scene: Phaser.Scene) =>
    {
        setSnapshot((scene as BoardScene).getSnapshot());
    };

    const startMode = (id: string) =>
    {
        setSnapshot(null);
        setModeId(id);
    };

    const toMenu = () =>
    {
        setSnapshot(null);
        setModeId(null);
    };

    const restart = () =>
    {
        const board = phaserRef.current?.scene as BoardScene | undefined;
        board?.restartGame();
    };

    if (modeId === null)
    {
        return <MainMenu onSelect={startMode} />;
    }

    return (
        <>
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} modeId={modeId} />
            <Hud snapshot={snapshot} onRestart={restart} onMenu={toMenu} />
        </>
    );
}

export default App
```
- **GOTCHA**: `startMode`/`toMenu` null the snapshot first so the HUD from a prior game never flashes over the menu or the next game's first frame. Fresh scene-ready re-seeds it.
- **VALIDATE**: `npm run typecheck`

### Task 8: `public/style.css` — menu + menu-button + overlay-actions
Append:
```css
#menu-layer {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #111418;
}

#menu-box {
    width: 100%;
    height: 100%;
    max-width: 100vh;
    aspect-ratio: 9 / 16;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 48px;
    color: #e8e2d0;
}

.menu-title {
    font-size: 2.4rem;
    font-weight: 700;
    letter-spacing: 0.04em;
}

.menu-modes {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 70%;
}

.menu-mode-button {
    padding: 18px;
    font-size: 1.3rem;
    background: transparent;
    color: #e8e2d0;
    border: 2px solid #e8e2d0;
    border-radius: 10px;
    cursor: pointer;
}

.menu-mode-button:hover {
    background: #e8e2d0;
    color: #111418;
}

.hud-menu-button {
    position: absolute;
    top: 4%;
    left: 6%;
    padding: 6px 14px;
    font-size: 0.9rem;
    background: transparent;
    color: #e8e2d0;
    border: 1px solid rgba(232, 226, 208, 0.5);
    border-radius: 6px;
    cursor: pointer;
    pointer-events: auto;
}

.hud-overlay-actions {
    display: flex;
    gap: 16px;
}

.hud-button-secondary {
    background: transparent;
    color: #e8e2d0;
    border: 1px solid #e8e2d0;
}
```
- **GOTCHA**: `#menu-box` uses `max-width: 100vh; aspect-ratio: 9/16` to mirror the game's portrait pillar so the menu reads consistently on desktop. `.hud-menu-button` MUST keep `pointer-events: auto`.
- **VALIDATE**: visual, Task 9.

### Task 9: validation sweep + genericity proof
```bash
npm run typecheck        # 0
npm test                 # 17/17 (engine untouched)
npm run build            # clean
git diff --stat -- src/game/engine src/game/scenes/BoardScene.ts   # EMPTY — the proof: shell added, scene/engine untouched
grep -rn "Phaser\." src/App.tsx src/PhaserGame.tsx src/ui/ src/game/main.ts src/game/scenes/Boot.ts   # only TYPE positions (Phaser.Scene/Phaser.Game)
npm run dev
```
Browser validation:
1. Fresh tab → menu shows title + one "Well Board" button, zero console errors.
2. Tap "Well Board" → board appears, HUD "Red: place pebble (1/2)", top-left "Menu" button visible.
3. Play the T4 line to a win → overlay shows [Play again] [Menu].
4. Tap "Play again" → fresh board, still in game.
5. Tap top-left "Menu" mid-game → returns to menu, no console error.
6. From menu, start again → board is fresh (no leftover pebbles from before).
7. Tap "Menu" on the win overlay (win a game first) → returns to menu.
8. **Genericity proof (the point of this phase)**: temporarily add a 2nd entry to `MODES` in `registry.ts` reusing WELL data under a new id/name (e.g. `{ ...WELL_MODE, id: 'well2', name: 'Well Board II' }`) — reload → menu lists TWO buttons; tap the 2nd → it plays identically; confirm `git diff` touched ONLY `registry.ts` (no BoardScene/engine edit). Then REVERT registry.ts; `git status` clean on it.
9. Narrow viewport (390×844) → menu centered and readable.

---

## Testing Strategy
No new unit tests (shell/UI). Engine's 17 tests are the regression gate. Browser script (esp. step 8 genericity proof) is the functional test — it directly validates the PRD Key Hypothesis.

## Acceptance Criteria
- [ ] Menu lists `MODES` generically; launching a mode works
- [ ] menu → game → win → menu loop closes (both win-overlay Menu and during-play Menu)
- [ ] Fake 2nd registry entry appears + plays with edits confined to `registry.ts` (then reverted)
- [ ] `git diff` on `engine/` and `BoardScene.ts` empty for the phase
- [ ] 17/17 tests, typecheck 0, build clean, zero console errors
- [ ] No bare `Phaser.` runtime refs (grep clean of value positions)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| registry.set timing (Boot reads before set) | L | M | set is sync, boot deferred; step 2 browser check confirms board loads. Fallback: `callbacks.preBoot` per docs |
| Mount/unmount leaves stale WebGL/game | L | M | template cleanup already destroys on unmount; step 5→6 verifies a clean re-entry |
| Menu button overlaps a board vertex on tap | L | L | top-left at 4%/6%; topmost vertex N at ~22% — no overlap; step 2/5 confirm |

## Notes
- After validation: commit `feat: add mode-select menu and menu navigation`.
- This completes all 5 PRD phases. Suggested follow-up: open a PR (`/ecc:prp-pr`), resolve the working-title name, and capture modes 2/3 in their own PRD when Reza's ideas firm up.
- Report → `.claude/PRPs/reports/phase-5-shell-polish-report.md`; flip PRD row 5 to complete.
