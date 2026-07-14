# Plan: Phase 1 — Scaffold (Pebble Trap)

## Summary
Import the official `phaserjs/template-react-ts` into this empty repo, strip its demo game, lock resolution to 720×1280 portrait (desktop = centered pillar), lay down the engine/modes/scenes/render folder skeleton with compiling type stubs, and wire vitest. Output: running empty portrait game + green sanity test. No game rules in this phase.

## User Story
As the developer, I want a clean portrait-locked Phaser+React+TS skeleton with hard layer boundaries, so that phases 2 (engine) and 3 (render) can start in parallel on a stable base.

## Problem → Solution
Empty repo (only `.git` + PRD) → running template-based app: portrait pillar on any window shape, demo removed, folders + stubs matching the PRD architecture, `npm test` green.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/pebble-trap.prd.md`
- **PRD Phase**: 1 — Scaffold
- **Estimated Files**: ~16 touched after template import (5 deleted, 4 modified, 7 created)

---

## UX Design

### Before
```
(nothing — empty repo)
```

### After
```
┌───────────────────────────────┐
│███████┌───────────┐███████████│  wide desktop window
│███████│           │███████████│  → 9:16 canvas pillar,
│███████│  Pebble   │███████████│    centered, dark letterbox
│███████│   Trap    │███████████│    (#111418) left/right
│███████│(placeholder)██████████│
│███████│           │███████████│  phone / narrow window
│███████└───────────┘███████████│  → canvas fits width,
│                               │    letterbox top/bottom
└───────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Browser open | n/a | placeholder text on portrait canvas | no interactivity this phase |

---

## Mandatory Reading

PRE-import (exists now):

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/pebble-trap.prd.md` | "Technical Approach" + "Game Rules" sections | normative types, layout, portrait config |

POST-import (template files land in Task 1 — read before editing them):

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/game/main.ts` | all (~30) | game config to modify (Task 5) |
| P0 | `src/PhaserGame.tsx` | all | React↔Phaser bridge — do NOT modify; depends on `current-scene-ready` event |
| P1 | `src/game/EventBus.ts` | all | keep as-is; scenes must emit through it |
| P1 | `src/App.tsx` | all | demo UI to replace (Task 4) |
| P2 | `vite/config.dev.mjs`, `vite/config.prod.mjs` | all | vite configs live HERE, not vite.config.ts (affects vitest wiring) |
| P2 | `package.json`, `tsconfig.json`, `index.html`, `public/style.css` | all | scripts/telemetry/CSS to change |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Template | github.com/phaserjs/template-react-ts | official; Vite 6, dev server :8080; demo scenes Boot/Preloader/MainMenu/Game/GameOver |
| Versions | template package.json (fetched 2026-07-14) | **phaser 4.0.0**, react ^19.0.0, typescript ~5.7.2, vite ^6.3.1 |
| Telemetry | template README | `log.js` pings anonymous stats on dev/build; `-nolog` variants exist; we remove it |

KEY_INSIGHT: template ships Phaser 4.0.0 (not 3.x). Phaser 4 keeps the v3 API surface for Scale/Scene/Graphics/Tweens/Input.
APPLIES_TO: whole project; PRD updated to say Phaser 4.
GOTCHA: if Phaser 4 shows a blocking regression later (phase 3 Graphics/arc work), fallback = `npm i phaser@^3.90` — API-compatible for everything this project uses. Decide then, not now.

---

## Patterns to Mirror

### EVENT_BRIDGE (scene → React handshake)
// SOURCE: src/PhaserGame.tsx (template, fetched verbatim 2026-07-14)
```ts
EventBus.on('current-scene-ready', (scene_instance: Phaser.Scene) => { ... });
```
Every playable scene MUST end `create()` with `EventBus.emit('current-scene-ready', this);` or the React ref never receives the scene.

### GAME_BOOTSTRAP (config + StartGame)
// SOURCE: src/game/main.ts (template shape: 1024×768, AUTO, parent 'game-container', StartGame(parent) merges config)
```ts
const StartGame = (parent: string) => { return new Game({ ...config, parent }); };
export default StartGame;
```
Keep this exact export shape — `src/PhaserGame.tsx` imports `StartGame from './game/main'` and calls `StartGame("game-container")`.

### CODE_STYLE
Template uses 4-space indent, single quotes, semicolons, PascalCase scene classes with named exports (`export class Boot extends Scene`). Match it.

### NORMATIVE_TYPES
// SOURCE: PRD "Core engine types + signatures" — copy verbatim into stubs (Task 6), do not improvise.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| (template import) | CREATE | Task 1 copies whole template into repo root |
| `log.js` | DELETE | telemetry ping |
| `src/game/scenes/Preloader.ts`, `MainMenu.ts`, `Game.ts`, `GameOver.ts` | DELETE | demo scenes |
| `public/assets/*` (demo images) | DELETE | demo assets; keep empty `public/assets/` dir |
| `package.json` | UPDATE | scripts: de-telemetry, add test/typecheck |
| `src/game/main.ts` | UPDATE | 720×1280 + Scale.FIT + scene list |
| `src/App.tsx` | UPDATE | bare `<PhaserGame />`, drop demo buttons/state |
| `src/game/scenes/Boot.ts` | UPDATE | minimal: start BoardScene |
| `public/style.css` | UPDATE | full-viewport flex letterbox |
| `src/game/scenes/BoardScene.ts` | CREATE | placeholder scene |
| `src/game/engine/types.ts` | CREATE | normative engine types (PRD verbatim) |
| `src/game/modes/types.ts` | CREATE | GameModeDef + Stroke |
| `src/game/modes/registry.ts` | CREATE | empty MODES record |
| `src/game/render/theme.ts` | CREATE | colors/radii/durations |
| `vitest.config.ts` | CREATE | node env, engine tests only |
| `src/game/engine/__tests__/sanity.test.ts` | CREATE | proves vitest wiring |

## NOT Building
- Game rules / `rules.ts` / `board.ts` (phase 2)
- Board drawing, strokes, arcs (phase 3) — placeholder text only
- Input, HUD, win flow (phase 4); menu/mode-select (phase 5)
- Well-mode registry entry (lands with board data in phases 2–3)
- `src/ui/` React components (phase 5; folder not needed yet)
- ESLint config changes, CI, deployment

---

## Step-by-Step Tasks

### Task 1: Import template into repo root
- **ACTION**: clone template to scratch, copy contents (template has no nested `.git` after removal) into repo root.
- **IMPLEMENT**:
```bash
cd /private/tmp/claude-501/-Users-reza-dumb-dumb-man/21e34863-c646-4265-abf1-926493d6cf0e/scratchpad
git clone --depth 1 https://github.com/phaserjs/template-react-ts tpl
rm -rf tpl/.git
cp -R tpl/. /Users/reza/dumb-dumb-man/
```
- **GOTCHA**: repo root already has `.git/` and `.claude/` — `cp -R tpl/. .` merges without touching them. Verify no collision beforehand: `ls tpl` (template has no `.claude`).
- **VALIDATE**: `ls /Users/reza/dumb-dumb-man` shows `package.json src public vite index.html tsconfig.json log.js`; `.claude/PRPs/` still intact; `git status` shows only untracked additions.

### Task 2: Install + baseline run (prove template works BEFORE modifying)
- **ACTION**: `npm install`, then `npm run dev-nolog`, open http://localhost:8080 — demo renders.
- **GOTCHA**: use `dev-nolog` (plain `dev` fires the telemetry ping we haven't removed yet). Port 8080 busy → vite auto-increments; read actual port from stdout.
- **VALIDATE**: HTTP 200 + demo visible. Stop server after check.

### Task 3: Remove telemetry, fix scripts
- **ACTION**: delete `log.js`; rewrite `package.json` scripts block to exactly:
```json
"scripts": {
    "dev": "vite --config vite/config.dev.mjs",
    "build": "vite build --config vite/config.prod.mjs",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
}
```
(drop `dev-nolog`/`build-nolog` duplicates; `test` becomes real in Task 7).
- **GOTCHA**: template's original `dev`/`build` invoke `node log.js …` — deleting `log.js` without editing scripts breaks them.
- **VALIDATE**: `npm run dev` boots clean, no `log.js` error, no network ping.

### Task 4: Strip demo game
- **ACTION**: delete `src/game/scenes/{Preloader,MainMenu,Game,GameOver}.ts`; delete demo images under `public/assets/` (keep the directory, add `.gitkeep`); replace `src/App.tsx`; rewrite `src/game/scenes/Boot.ts`; create `src/game/scenes/BoardScene.ts`.
- **IMPLEMENT** — `src/App.tsx`:
```tsx
import { PhaserGame } from './PhaserGame';

function App() {
    return <PhaserGame />;
}

export default App;
```
`src/game/scenes/Boot.ts`:
```ts
import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.scene.start('BoardScene');
    }
}
```
`src/game/scenes/BoardScene.ts`:
```ts
import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class BoardScene extends Scene {
    constructor() {
        super('BoardScene');
    }

    create() {
        this.add.text(360, 640, 'Pebble Trap\n(board arrives in phase 3)', {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5);

        EventBus.emit('current-scene-ready', this);
    }
}
```
- **MIRROR**: EVENT_BRIDGE — the emit line is mandatory. Do NOT edit `src/PhaserGame.tsx` or `src/game/EventBus.ts`.
- **GOTCHA**: demo `App.tsx` imports `MainMenu` scene + uses sprite state — full replace, or dangling imports break the build.
- **VALIDATE**: `npm run typecheck` → zero errors (no references to deleted scenes anywhere: `grep -rn "MainMenu\|Preloader\|GameOver" src/` returns nothing).

### Task 5: Portrait lock
- **ACTION**: rewrite `src/game/main.ts`; rewrite `public/style.css`.
- **IMPLEMENT** — `src/game/main.ts`:
```ts
import { AUTO, Game } from 'phaser';
import { Boot } from './scenes/Boot';
import { BoardScene } from './scenes/BoardScene';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 720,
    height: 1280,
    parent: 'game-container',
    backgroundColor: '#111418',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [Boot, BoardScene],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
```
`public/style.css`:
```css
* {
    margin: 0;
    padding: 0;
}

html,
body,
#root {
    width: 100%;
    height: 100%;
    background: #111418;
    overflow: hidden;
}

#game-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}

#game-container canvas {
    max-width: 100%;
    max-height: 100%;
}
```
- **MIRROR**: GAME_BOOTSTRAP — keep `StartGame(parent)` default export exactly.
- **GOTCHA**: `Scale.FIT` sizes the canvas from the PARENT element — `#game-container` must have real dimensions, hence the 100% height chain `html→body→#root→#game-container`. Check `index.html` links `style.css` and mounts `#root` (template default; adjust only if missing).
- **VALIDATE**: `npm run dev` → wide window: canvas is a centered 9:16 pillar, dark letterbox left/right; narrow window (devtools mobile emulation): letterbox top/bottom. Canvas aspect stays 9:16 at every size.

### Task 6: Folder skeleton + normative stubs
- **ACTION**: create dirs `src/game/engine/__tests__`, `src/game/modes/well`, `src/game/render`; add stub files.
- **IMPLEMENT** — `src/game/engine/types.ts` (PRD-verbatim, plus exports):
```ts
// engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/)
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
}

export interface GameState {
    modeId: string;
    phase: Phase;
    board: Record<VertexId, PlayerId | null>;
    current: PlayerId;
    placed: Record<PlayerId, number>;
    winner: PlayerId | null;
}

export type Move =
    | { kind: 'place'; to: VertexId }
    | { kind: 'move'; from: VertexId; to: VertexId };
```
`src/game/modes/types.ts`:
```ts
import type { EngineConfig, VertexId } from '../engine/types';

export type Stroke =
    | { kind: 'segment'; from: VertexId; to: VertexId }
    | { kind: 'arc'; cx: number; cy: number; radius: number; startDeg: number; endDeg: number };

export interface GameModeDef {
    id: string;
    name: string;
    engine: EngineConfig;
    boardStrokes: Stroke[];
}
```
`src/game/modes/registry.ts`:
```ts
import type { GameModeDef } from './types';

// Well mode registers here in phases 2-3 (src/game/modes/well/index.ts)
export const MODES: Record<string, GameModeDef> = {};
```
`src/game/render/theme.ts`:
```ts
export const THEME = {
    background: 0x111418,
    boardLine: 0xe8e2d0,
    vertexDot: 0xe8e2d0,
    pebble: { 1: 0xe53935, 2: 0x1e88e5 },
    pebbleRadius: 34,
    vertexRadius: 12,
    tapRadius: 48,
    moveTweenMs: 200,
} as const;
```
`src/game/modes/well/` stays empty except `.gitkeep` (board data lands in phase 2/3).
- **GOTCHA**: layering is one-way — `modes/` may import `engine/`, never the reverse. Nothing under `engine/` may import phaser (PRD calls this a review-blocker).
- **VALIDATE**: `npm run typecheck` → zero errors; `grep -rn "from 'phaser'" src/game/engine/` returns nothing.

### Task 7: Vitest wiring
- **ACTION**: `npm install -D vitest`; create root `vitest.config.ts`; add sanity test.
- **IMPLEMENT** — `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/game/engine/**/*.test.ts'],
    },
});
```
`src/game/engine/__tests__/sanity.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('scaffold sanity', () => {
    it('vitest runs', () => {
        expect(1 + 1).toBe(2);
    });
});
```
- **GOTCHA**: template's vite configs live at `vite/config.dev.mjs` / `vite/config.prod.mjs` — vitest does NOT pick those up automatically. The standalone root `vitest.config.ts` is intentional and sufficient (engine tests are pure TS, node env, no react plugin, no jsdom).
- **VALIDATE**: `npm test` → 1 passed.

### Task 8: Full validation sweep
- **ACTION**: run all validation commands (below), fix anything red.
- **VALIDATE**: see Validation Commands — all green.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| sanity.test.ts | 1+1 | 2 | no — proves wiring only; real vectors T1–T7 arrive in phase 2 |

### Edge Cases Checklist
- [x] Wide desktop window → side letterbox (manual)
- [x] Narrow/mobile window → top/bottom letterbox (manual)
- [x] Port 8080 occupied → vite auto-increments (read stdout)
- [ ] ~~Empty input / concurrency / network~~ — n/a for scaffold

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: zero errors

### Unit Tests
```bash
npm test
```
EXPECT: 1 test, 1 passed

### Build
```bash
npm run build
```
EXPECT: dist/ produced, no errors

### Browser Validation
```bash
npm run dev
```
EXPECT: placeholder text on 720×1280 canvas; 9:16 pillar preserved when resizing wide AND narrow

### Manual Validation
- [ ] Desktop wide window: dark pillar centered, canvas never full-width
- [ ] Devtools iPhone emulation: canvas fills width, letterbox top/bottom
- [ ] Hot reload: edit BoardScene text → browser updates without refresh
- [ ] `git status`: only intended files; `.claude/` and `.git/` untouched

---

## Acceptance Criteria
- [ ] All 8 tasks completed
- [ ] All validation commands green
- [ ] Demo fully removed (`grep -rn "MainMenu\|Preloader\|GameOver" src/` empty)
- [ ] No telemetry (`log.js` gone, scripts clean)
- [ ] Folder layout matches PRD architecture section
- [ ] Portrait pillar verified both window orientations

## Completion Checklist
- [ ] Stubs are PRD-verbatim types (no improvisation)
- [ ] `PhaserGame.tsx` / `EventBus.ts` unmodified
- [ ] `engine/` has zero non-engine imports
- [ ] Code style matches template (4-space, single quotes, semicolons)
- [ ] PRD phase 1 row flipped to `complete` after validation (done by implement step)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phaser 4.0.0 regression (new major) | L | M | scaffold uses only Scale/Scene/Text — stable API; fallback pin `phaser@^3.90` documented above |
| Template structure drifts from this plan | L | L | Task 2 validates BEFORE edits; adjust file paths from what's on disk, plan captures intent |
| npm/network failure during clone/install | L | L | retry; clone via https needs no auth |

## Notes
- PRD updated alongside this plan: stack is Phaser 4.0.0 (template current), phase 1 → `in-progress`.
- No git commit in this plan — user decides when to commit (suggest one commit after full validation: `feat: scaffold portrait phaser shell`).
- Phases 2 (engine) and 3 (board render) may start in parallel once this completes.
