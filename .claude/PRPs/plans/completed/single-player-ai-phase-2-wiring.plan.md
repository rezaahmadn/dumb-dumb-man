# Plan: Single-Player AI — Phase 2 (Mode-Select + Wiring)

## Summary
Wires Phase 1's headless `chooseMove` solver into the actual game: a new Solo/Hotseat select screen, an `opponentType` value threaded from React through Phaser's registry into `BoardScene`, AI-turn detection + a delayed `applyAndSync(chooseMove(...))` call reusing the exact same move-application path human taps use, input-blocking while it's the AI's turn, and a "thinking..." HUD indicator. Zero engine changes, zero changes to `ai.ts` itself.

## User Story
As a solo player, I want to pick "Solo" from a mode-select screen and play a full game against the computer opponent added in Phase 1, so I can play Pebble Trap with no second human present.

## Problem → Solution
`chooseMove` exists and is proven correct but nothing calls it — the game is still hotseat-only in the browser. → Add a Solo/Hotseat select step and a small turn-gating hook in `BoardScene` so the AI's turn is detected and played automatically through the same `applyAndSync` path as human moves.

## Metadata
- **Complexity**: Medium (1 new file, 7 updated files, ~150-200 lines, no new concepts — pure wiring of an already-solved problem)
- **Source PRD**: `.claude/PRPs/prds/single-player-ai.prd.md`
- **PRD Phase**: 2 — "Mode-select + wiring"
- **Estimated Files**: 8 (1 new, 7 updated)

---

## UX Design

### Before
```
┌─────────────────────────────┐
│  MainMenu (board select)     │
│  [ Well Board ]               │
└─────────────────────────────┘
              │ click
              ▼
┌─────────────────────────────┐
│  Board mounts directly.      │
│  Always 2 humans, hotseat.   │
└─────────────────────────────┘
```

### After
```
┌─────────────────────────────┐
│  MainMenu (board select)     │
│  [ Well Board ]               │
└─────────────────────────────┘
              │ click
              ▼
┌─────────────────────────────┐
│  OpponentSelect (new)        │
│  [ Solo (vs AI) ]             │
│  [ Hotseat (2 Players) ]      │
└─────────────────────────────┘
              │ click
              ▼
┌─────────────────────────────┐
│  Board mounts. Solo: after   │
│  human's move, if it's now   │
│  Blue's turn, AI moves after │
│  a short delay via the same  │
│  applyAndSync tap-path used  │
│  by humans. HUD shows        │
│  "Blue is thinking..." while │
│  waiting. Hotseat: unchanged.│
└─────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Menu → board | 1 click (board mode) | 2 clicks (board mode, then Solo/Hotseat) | New `OpponentSelect` screen, reuses existing `.menu-*` CSS classes verbatim |
| Board input during opponent's turn | Always tappable/draggable (hotseat: expected — it's the other human's turn) | Solo mode only: input blocked while `current === AI_PLAYER` (`onVertexTap` early-return + `refreshDraggable` guard) | Hotseat unaffected — guard only fires when `opponentType === 'ai'` |
| HUD turn text | `"Blue: move a pebble"` | Solo mode, AI's turn: `"Blue is thinking..."` | Hotseat unaffected — `aiPlayer` prop is `null` there |
| Menu button (mid-game) | Resets `modeId` only | Resets `modeId` AND `opponentType` | Returning to menu always re-asks Solo/Hotseat |

---

## Mandatory Reading

Files that MUST be read before implementing:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/game/scenes/BoardScene.ts` | 1-388 (full file) | Everything changes around `applyAndSync` (361-367), `onVertexTap` (160-200), `refreshDraggable` (347-359), `init`/`create` (40-74). Read the whole file — it's the center of this phase. |
| P0 | `src/App.tsx` | 1-61 (full file) | Current 2-state (`modeId`/`snapshot`) render gate becomes 3-state (adds `opponentType`). `startMode`/`toMenu`/`restart` all need small edits. |
| P0 | `.claude/PRPs/prds/single-player-ai.prd.md` | User Flow, Architecture Notes, Core Capabilities, Decisions Log | Normative spec: human=player 1 always, AI=player 2 always, AI-turn check happens inside `BoardScene` after `applyAndSync` (NOT via the React-facing `game-state-changed` EventBus — that emit is HUD-only), `opponentType` must not collide with the existing `modeId` (board ruleset) concept. |
| P1 | `src/game/engine/ai.ts` | full file (from Phase 1) | The only new import this phase adds to `BoardScene.ts` — `chooseMove(cfg, state): Move`. Signature only; do not modify. |
| P1 | `src/game/main.ts` | 1-32 (full file) | `StartGame(parent, modeId)` currently sets `game.registry.set('modeId', modeId)` — `opponentType` must follow this exact same registry-relay pattern, not a new mechanism. |
| P1 | `src/game/scenes/Boot.ts` | 1-15 (full file) | Reads `modeId` from registry, passes it as `scene.start('BoardScene', { modeId })` data — `opponentType` follows the identical path. |
| P1 | `src/PhaserGame.tsx` | 1-81 (full file) | `modeId` prop threads from React props into `StartGame(...)` call inside `useLayoutEffect` (line 26) — `opponentType` prop mirrors this exactly. |
| P1 | `src/ui/Hud.tsx` | 1-65 (full file) | `turnText` (11-21) is where the "thinking..." branch goes; `HudSnapshot` type (imported from `BoardScene.ts`) is NOT changed — `aiPlayer` arrives as a separate prop from `App.tsx`, not through the snapshot. |
| P1 | `src/ui/MainMenu.tsx` | 1-32 (full file) | Direct template for the new `OpponentSelect.tsx` — same `#menu-layer`/`#menu-box`/`.menu-title`/`.menu-modes`/`.menu-mode-button` structure, static buttons instead of a `MODES` map. |
| P2 | `public/style.css` | 116-165 | Confirms `.menu-*` classes are generic enough to reuse verbatim for `OpponentSelect` — no new CSS needed. |
| P2 | `src/game/render/theme.ts` | 1-17 (full file) | Where the new `aiMoveDelayMs` constant goes, next to the existing `moveTweenMs`. |
| P2 | `vitest.config.ts` | full file | Confirms (deliberately) `include: ['src/game/engine/**/*.test.ts']` only — this repo has zero React/Phaser UI test coverage by design (node environment, no jsdom/react plugin). Phase 2 validation is typecheck + manual browser playtest, not new automated tests — do not invent a UI test task. |

## External Documentation
No external research needed — pure wiring inside an existing, fully-understood Phaser 4 + React 19 template. No new npm dependencies.

---

## Patterns to Mirror

### BRACE_STYLE (UI/scene files — DIFFERENT from engine/)
// SOURCE: src/game/scenes/BoardScene.ts:35-38, src/App.tsx:9-10
```ts
constructor ()
{
    super('BoardScene');
}
```
Every file this phase touches (`BoardScene.ts`, `App.tsx`, `Hud.tsx`, `PhaserGame.tsx`, `main.ts`, `Boot.ts`, the new `OpponentSelect.tsx`) uses **Allman style**: opening brace on its own line, and a space before the parameter list `(`. This is the opposite of `engine/`'s K&R style (brace on the same line, no space before `(`) used in Phase 1. Do not carry Phase 1's engine brace style into this phase's files.

### REGISTRY_RELAY (React prop → Phaser scene data)
// SOURCE: src/game/main.ts:24-30, src/game/scenes/Boot.ts:10-14
```ts
const StartGame = (parent: string, modeId = 'well') => {
    const game = new Game({ ...config, parent });
    game.registry.set('modeId', modeId);
    return game;
}
```
```ts
create ()
{
    const modeId = (this.registry.get('modeId') as string | undefined) ?? 'well';
    this.scene.start('BoardScene', { modeId });
}
```
`opponentType` must follow this exact relay: React prop → `StartGame` param → `game.registry.set(...)` → `Boot.create()` reads registry → passed as `scene.start('BoardScene', { ...data })`. Do not invent a second mechanism (e.g. a module-level singleton) for this one value.

### SCENE_DATA_DEFAULTING
// SOURCE: src/game/scenes/BoardScene.ts:15-18, 40-49
```ts
interface BoardSceneData
{
    modeId?: string;
}
```
```ts
init (data: BoardSceneData)
{
    const modeId = data.modeId ?? 'well';
    ...
}
```
`opponentType` is optional on `BoardSceneData` and defaulted with `??` exactly like `modeId` — `data.opponentType ?? 'human'`. Hotseat must remain the default if the field is ever absent (defensive default, matches `modeId`'s own `'well'` default).

### APPLY_AND_SYNC_REUSE (never a second move-application path)
// SOURCE: src/game/scenes/BoardScene.ts:361-367
```ts
private applyAndSync (move: Move)
{
    this.syncPebbles(move);
    this.state = applyMove(this.mode.engine, this.state, move);
    this.refreshDraggable();
    EventBus.emit('game-state-changed', this.getSnapshot());
}
```
The AI's move MUST go through this exact same private method a human tap uses (`this.applyAndSync(chooseMove(this.mode.engine, this.state))`) — this is why the plan needs zero new pebble-sync, zero new terminal-state handling, and zero new EventBus emit code. Do not write a parallel "apply AI move" path.

### MAIN_MENU_SCREEN_STRUCTURE
// SOURCE: src/ui/MainMenu.tsx:8-31
```tsx
export function MainMenu ({ onSelect }: MainMenuProps)
{
    const modes = Object.values(MODES);
    return (
        <div id="menu-layer">
            <div id="menu-box">
                <h1 className="menu-title">Pebble Trap</h1>
                <div className="menu-modes">
                    {modes.map((mode) => (
                        <button key={mode.id} type="button" className="menu-mode-button" onClick={() => onSelect(mode.id)}>
                            {mode.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
```
`OpponentSelect.tsx` mirrors this exactly (same three nested elements, same class names) but with two static buttons instead of a `.map()` over a registry — reuses `public/style.css`'s `.menu-*` rules verbatim, zero new CSS.

### HUD_PROP_THREADING (data NOT smuggled through HudSnapshot)
// SOURCE: src/ui/Hud.tsx:4-9, src/App.tsx:52-57
```ts
interface HudProps
{
    snapshot: HudSnapshot | null;
    onRestart: () => void;
    onMenu: () => void;
}
```
```tsx
<Hud snapshot={snapshot} onRestart={restart} onMenu={toMenu} />
```
`aiPlayer: PlayerId | null` is added as a new, independent `Hud` prop supplied directly from `App.tsx`'s own `opponentType` state (`opponentType === 'ai' ? 2 : null`) — NOT added to `HudSnapshot`/`getSnapshot()`. `BoardScene.ts` does not need to know or emit anything about how the HUD chooses to label whose turn it is; keeps the HUD-only "thinking" label fully on the React side, matching how `HudSnapshot` already only carries engine-facing data (`game`, `pebblesPerPlayer`), not presentation-only state.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/ui/OpponentSelect.tsx` | CREATE | New Solo/Hotseat select screen |
| `src/game/render/theme.ts` | UPDATE | Add `aiMoveDelayMs` constant |
| `src/game/scenes/BoardScene.ts` | UPDATE | `opponentType` field, `AI_PLAYER` const, turn-gating in `onVertexTap`/`refreshDraggable`, `maybeScheduleAiMove`, import `chooseMove` |
| `src/game/main.ts` | UPDATE | `StartGame` takes + relays `opponentType` |
| `src/game/scenes/Boot.ts` | UPDATE | Reads `opponentType` from registry, passes to `BoardScene` start data |
| `src/PhaserGame.tsx` | UPDATE | New `opponentType` prop threaded to `StartGame` |
| `src/App.tsx` | UPDATE | `opponentType` state, 3-step render gate, `aiPlayer` prop to `Hud` |
| `src/ui/Hud.tsx` | UPDATE | `aiPlayer` prop, "thinking..." turn text branch |

## NOT Building
- Fastest-win/slowest-loss tie-break (PRD "Should", explicitly "skippable for a first pass" — Open Question #2 stays open)
- Difficulty levels, weakened bot, color/turn-order choice, undo vs. AI — all out of v1 per PRD "What We're NOT Building"
- Any change to `src/game/engine/ai.ts`, `rules.ts`, or `types.ts` — Phase 2 is wiring only
- New automated UI tests — this repo has zero React/Phaser test coverage by design (`vitest.config.ts` scopes to `engine/**` only, node environment); Phase 2's own success signal in the PRD is an in-browser manual playtest, not a new test suite

---

## Step-by-Step Tasks

### Task 1: `aiMoveDelayMs` theme constant
- **ACTION**: Add one constant to `THEME` in `src/game/render/theme.ts`.
- **IMPLEMENT**:
  ```ts
  export const THEME = {
      background: 0x111418,
      boardLine: 0xe8e2d0,
      boardLineWidth: 6,
      vertexDot: 0xe8e2d0,
      pebble: { 1: 0xe53935, 2: 0x1e88e5 },
      pebbleRadius: 34,
      vertexRadius: 12,
      tapRadius: 120,
      moveTweenMs: 200,
      highlightColor: 0xffffff,
      aiMoveDelayMs: 400
  } as const;
  ```
- **MIRROR**: existing `THEME` object shape — just one added key, alongside `moveTweenMs` (same unit, same purpose: a UI-feel timing constant).
- **IMPORTS**: none new.
- **GOTCHA**: none.
- **VALIDATE**: `npm run typecheck`.

### Task 2: `BoardScene` — data, fields, turn-gating, AI move scheduling
- **ACTION**: Update `src/game/scenes/BoardScene.ts`: import `chooseMove`; add `opponentType` to `BoardSceneData` and as a private field; add `AI_PLAYER` module constant; add turn-gating guards to `onVertexTap` and `refreshDraggable`; add `maybeScheduleAiMove`, called from `applyAndSync`.
- **IMPLEMENT**:
  ```ts
  import { applyMove, initialState, legalMoves } from '../engine/rules';
  import { chooseMove } from '../engine/ai';
  import type { GameState, Move, PlayerId, VertexId } from '../engine/types';
  ```
  ```ts
  //  Human is always player 1 (red), AI always player 2 (blue) — matches
  //  initialState's existing default (player 1 moves first) and the PRD
  //  Decisions Log. Never derived dynamically; v1 has exactly one AI seat.
  const AI_PLAYER: PlayerId = 2;
  ```
  ```ts
  interface BoardSceneData
  {
      modeId?: string;
      opponentType?: 'human' | 'ai';
  }
  ```
  Add a private field alongside the existing ones (near `private legalDestinations`):
  ```ts
  private opponentType: 'human' | 'ai' = 'human';
  ```
  In `init`, after the existing `this.mode = mode;`:
  ```ts
  this.opponentType = data.opponentType ?? 'human';
  ```
  In `onVertexTap`, immediately after the existing `if (this.state.phase === 'gameover') { return; }` block:
  ```ts
  if (this.opponentType === 'ai' && this.state.current === AI_PLAYER)
  {
      return;
  }
  ```
  In `refreshDraggable`, change the `draggable` line:
  ```ts
  const draggable = this.state.phase === 'movement'
      && this.state.board[key] === this.state.current
      && !(this.opponentType === 'ai' && this.state.current === AI_PLAYER);
  ```
  New private method, placed after `applyAndSync`:
  ```ts
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
  Update `applyAndSync` to call it last:
  ```ts
  private applyAndSync (move: Move)
  {
      this.syncPebbles(move);
      this.state = applyMove(this.mode.engine, this.state, move);
      this.refreshDraggable();
      EventBus.emit('game-state-changed', this.getSnapshot());
      this.maybeScheduleAiMove();
  }
  ```
- **MIRROR**: BRACE_STYLE (Allman, space before `(`); SCENE_DATA_DEFAULTING (`?? 'human'`, same shape as `modeId`'s `?? 'well'`); APPLY_AND_SYNC_REUSE (the AI move is applied through the unmodified core of `applyAndSync` — only one line added at the end).
- **IMPORTS**: `chooseMove` from `../engine/ai`; `PlayerId` added to the existing `type` import from `../engine/types`.
- **GOTCHA**: `maybeScheduleAiMove` is called at the END of `applyAndSync`, so it naturally re-triggers itself for consecutive AI turns (e.g. AI places twice in a row during placement phase — 2nd and 4th placements both belong to player 2) without any extra loop or recursion-tracking code: each AI move ends by calling `applyAndSync` again, which calls `maybeScheduleAiMove` again, which either schedules the next AI move or (once `current` flips back to player 1) does nothing. Do not add a `while` loop or manual chaining — the existing call chain already handles it. Also: `refreshDraggable`'s new guard only affects `movement` phase (as before) — placement-phase input blocking is fully covered by the `onVertexTap` guard alone, since placement has no draggable pebbles yet.
- **VALIDATE**: `npm run typecheck`; manual — see Manual Validation checklist below.

### Task 3: `main.ts` + `Boot.ts` — relay `opponentType` through the registry
- **ACTION**: `StartGame` gains an `opponentType` parameter and sets it on the registry; `Boot.create` reads it and passes it to `BoardScene`'s start data.
- **IMPLEMENT** (`src/game/main.ts`):
  ```ts
  const StartGame = (parent: string, modeId = 'well', opponentType: 'human' | 'ai' = 'human') => {
      const game = new Game({ ...config, parent });
      game.registry.set('modeId', modeId);
      game.registry.set('opponentType', opponentType);
      return game;
  }
  ```
  **IMPLEMENT** (`src/game/scenes/Boot.ts`):
  ```ts
  create ()
  {
      const modeId = (this.registry.get('modeId') as string | undefined) ?? 'well';
      const opponentType = (this.registry.get('opponentType') as 'human' | 'ai' | undefined) ?? 'human';
      this.scene.start('BoardScene', { modeId, opponentType });
  }
  ```
- **MIRROR**: REGISTRY_RELAY pattern exactly — same two-line shape (`registry.set` in `main.ts`, `registry.get` + `??` default in `Boot.ts`) duplicated for the new key.
- **IMPORTS**: none new.
- **GOTCHA**: default parameter value (`'human'`) in `StartGame` matters for any caller that omits it — matches `modeId`'s existing `= 'well'` default, so an un-migrated caller (there are none, but keep the discipline) still gets hotseat, the current real behavior, not a silent AI opponent.
- **VALIDATE**: `npm run typecheck`.

### Task 4: `PhaserGame.tsx` — thread the new prop
- **ACTION**: Add `opponentType` to `IProps` and pass it into the `StartGame` call.
- **IMPLEMENT**:
  ```ts
  interface IProps
  {
      currentActiveScene?: (scene_instance: Phaser.Scene) => void
      modeId?: string
      opponentType?: 'human' | 'ai'
  }
  ```
  ```ts
  export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(function PhaserGame({ currentActiveScene, modeId, opponentType }, ref)
  {
      ...
      game.current = StartGame("game-container", modeId, opponentType);
      ...
  ```
- **MIRROR**: `modeId`'s existing prop shape and destructuring — `opponentType` is added the same way, one line down.
- **IMPORTS**: none new.
- **GOTCHA**: none — `StartGame`'s own default parameter (Task 3) covers `opponentType === undefined`, so no `?? 'human'` is needed at this call site (matches how `modeId` is already passed through un-defaulted here).
- **VALIDATE**: `npm run typecheck`.

### Task 5: `OpponentSelect.tsx` — new Solo/Hotseat screen
- **ACTION**: Create `src/ui/OpponentSelect.tsx`.
- **IMPLEMENT**:
  ```tsx
  interface OpponentSelectProps
  {
      onSelect: (opponentType: 'human' | 'ai') => void;
  }

  export function OpponentSelect ({ onSelect }: OpponentSelectProps)
  {
      return (
          <div id="menu-layer">
              <div id="menu-box">
                  <h1 className="menu-title">Pebble Trap</h1>
                  <div className="menu-modes">
                      <button type="button" className="menu-mode-button" onClick={() => onSelect('ai')}>
                          Solo (vs AI)
                      </button>
                      <button type="button" className="menu-mode-button" onClick={() => onSelect('human')}>
                          Hotseat (2 Players)
                      </button>
                  </div>
              </div>
          </div>
      );
  }
  ```
- **MIRROR**: MAIN_MENU_SCREEN_STRUCTURE exactly — same three nested elements, same class names, zero new CSS.
- **IMPORTS**: none — no engine/theme imports needed, unlike `MainMenu.tsx` (which imports `MODES`); this screen has two static, hardcoded options, not a registry map.
- **GOTCHA**: do not import `PlayerId`/`1`/`2` here — this component only knows the string union `'human' | 'ai'`, matching `BoardSceneData.opponentType`'s type exactly. The mapping "AI is player 2" lives only in `BoardScene.ts` (`AI_PLAYER` const) and `App.tsx` (Hud's `aiPlayer` prop), not here.
- **VALIDATE**: `npm run typecheck`.

### Task 6: `App.tsx` — three-step render gate
- **ACTION**: Add `opponentType` state; extend `toMenu` to reset it; add `startOpponent`; render `OpponentSelect` between `MainMenu` and the board; pass `aiPlayer` to `Hud`.
- **IMPLEMENT**:
  ```tsx
  import { useEffect, useRef, useState } from 'react';
  import { EventBus } from './game/EventBus';
  import type { BoardScene, HudSnapshot } from './game/scenes/BoardScene';
  import type { IRefPhaserGame } from './PhaserGame';
  import { PhaserGame } from './PhaserGame';
  import { Hud } from './ui/Hud';
  import { MainMenu } from './ui/MainMenu';
  import { OpponentSelect } from './ui/OpponentSelect';

  function App()
  {
      const phaserRef = useRef<IRefPhaserGame | null>(null);
      const [modeId, setModeId] = useState<string | null>(null);
      const [opponentType, setOpponentType] = useState<'human' | 'ai' | null>(null);
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

      const startOpponent = (type: 'human' | 'ai') =>
      {
          setSnapshot(null);
          setOpponentType(type);
      };

      const toMenu = () =>
      {
          setSnapshot(null);
          setModeId(null);
          setOpponentType(null);
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

      if (opponentType === null)
      {
          return <OpponentSelect onSelect={startOpponent} />;
      }

      return (
          <>
              <PhaserGame ref={phaserRef} currentActiveScene={currentScene} modeId={modeId} opponentType={opponentType} />
              <Hud snapshot={snapshot} onRestart={restart} onMenu={toMenu} aiPlayer={opponentType === 'ai' ? 2 : null} />
          </>
      );
  }

  export default App
  ```
- **MIRROR**: existing `startMode`/`toMenu` shape exactly — `startOpponent` is a same-shaped sibling to `startMode`.
- **IMPORTS**: add `OpponentSelect` from `./ui/OpponentSelect`.
- **GOTCHA**: `toMenu` must reset BOTH `modeId` and `opponentType` — resetting only `modeId` would leave the render gate skipping straight from `MainMenu` back into the board on the next mode pick (stale `opponentType` from the previous game), silently reusing the last-picked opponent type instead of re-asking. `aiPlayer={opponentType === 'ai' ? 2 : null}` is computed inline at the call site, not stored as separate state — it's fully derived from `opponentType`, which is already state; storing it separately would be a duplicated/desyncable source of truth.
- **VALIDATE**: `npm run typecheck`.

### Task 7: `Hud.tsx` — "thinking..." indicator
- **ACTION**: Add `aiPlayer` prop; branch `turnText` on it.
- **IMPLEMENT**:
  ```tsx
  import { PLAYER_COLOR_CSS, PLAYER_NAME } from '../game/render/theme';
  import type { HudSnapshot } from '../game/scenes/BoardScene';
  import type { PlayerId } from '../game/engine/types';

  interface HudProps
  {
      snapshot: HudSnapshot | null;
      onRestart: () => void;
      onMenu: () => void;
      aiPlayer: PlayerId | null;
  }

  function turnText (snapshot: HudSnapshot, aiPlayer: PlayerId | null): string
  {
      const { game, pebblesPerPlayer } = snapshot;
      const name = PLAYER_NAME[game.current];
      if (aiPlayer !== null && game.current === aiPlayer)
      {
          return `${name} is thinking...`;
      }
      if (game.phase === 'placement')
      {
          const n = game.placed[game.current] + 1;
          return `${name}: place pebble (${n}/${pebblesPerPlayer})`;
      }
      return `${name}: move a pebble`;
  }

  export function Hud ({ snapshot, onRestart, onMenu, aiPlayer }: HudProps)
  {
      ...
                  <div className="hud-turn" style={{ color: PLAYER_COLOR_CSS[game.current] }}>
                      {turnText(snapshot, aiPlayer)}
                  </div>
      ...
  }
  ```
  (Only the signature/import/call-site lines change; the rest of the component body — the `isOver`/overlay JSX — is unchanged.)
- **MIRROR**: BRACE_STYLE; HUD_PROP_THREADING (`aiPlayer` is a plain new prop, not folded into `HudSnapshot`).
- **IMPORTS**: add `PlayerId` (type-only) from `../game/engine/types`.
- **GOTCHA**: the `aiPlayer !== null && game.current === aiPlayer` check must run BEFORE the `phase === 'placement'` branch — the AI "thinks" during both placement and movement turns, so the thinking label must take priority over the placement counter text, not the other way around.
- **VALIDATE**: `npm run typecheck`.

---

## Testing Strategy

### Unit Tests
None — see "NOT Building": this repo has zero React/Phaser UI test coverage by design (`vitest.config.ts` scopes to `src/game/engine/**/*.test.ts` only, node environment, no jsdom/react plugin). Phase 1's engine-level tests (`ai.test.ts`) already prove `chooseMove` is correct; Phase 2 only wires an already-correct function into the UI, so its own correctness burden is "is it called at the right time," which is a runtime/manual concern, not a unit-testable one without introducing new test infrastructure — out of scope per PRD (no such task exists in Phase 2's Description).

### Edge Cases Checklist
- [x] AI must move twice in a row during placement (2nd and 4th placements both belong to player 2) — covered by Task 2's GOTCHA: `maybeScheduleAiMove`'s self-chaining via `applyAndSync` handles this without extra code; verify manually by watching Blue place twice before Red's second placement turn.
- [x] AI's own pebble must not be draggable during its own turn — `refreshDraggable`'s new guard (Task 2).
- [x] Tapping/dragging AI's pebble during AI's turn must no-op, not desync state — `onVertexTap`'s early-return guard (Task 2); pre-existing drop-handler snap-back logic (`BoardScene.ts:257-260`) already handles the visual case if a drag is attempted despite `draggable=false` being set (defense in depth, not required to change).
- [x] Returning to Menu mid-game and picking Solo again must re-ask Hotseat/Solo, not silently reuse the last choice — `toMenu` resets both `modeId` and `opponentType` (Task 6 GOTCHA).
- [x] Hotseat mode must be fully unaffected — every new guard is gated behind `opponentType === 'ai'`; hotseat's `opponentType` is always `'human'`, so `maybeScheduleAiMove` always no-ops and both new guards always evaluate to "no restriction."
- [ ] Concurrent access — N/A, single-threaded browser event loop, same as before this phase.
- [ ] Network failure — N/A, no I/O.

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: Zero type errors.

### Full Test Suite (regression only — no new tests this phase)
```bash
npm test
```
EXPECT: All 26 existing tests still pass (Phase 2 touches zero files under `src/game/engine/`).

### Browser Validation
```bash
npm run dev
```
EXPECT, manually, in the browser:
- Menu → Well Board → OpponentSelect screen appears with "Solo (vs AI)" / "Hotseat (2 Players)".
- Hotseat: pick it, confirm existing 2-human flow is completely unchanged (placement, movement, drag, trap, draw, restart, menu).
- Solo: pick it. Play as Red (place 2 pebbles). After each Red move, HUD should briefly show "Blue is thinking..." then Blue's pebble appears/moves automatically (~400ms delay) without any tap. Confirm Blue's own pebbles are never draggable/tappable by you. Play a full game to a trap-win or a draw; confirm the end-of-game overlay and [Play again]/[Menu] behave identically to hotseat's.
- No console errors at any point in either mode.

### Manual Validation
- [ ] `npm run typecheck` — clean
- [ ] `npm test` — all 26 green, unchanged
- [ ] Full Solo game playable start-to-finish with zero console errors, zero stuck turns
- [ ] Full Hotseat game still playable, byte-for-byte the same experience as before this phase

---

## Acceptance Criteria
- [ ] All 7 tasks completed
- [ ] All validation commands pass
- [ ] No type errors
- [ ] No lint errors (no eslint config in repo — see Phase 1 report; unchanged this phase)
- [ ] Zero changes under `src/game/engine/` (verify: `git diff --stat` shows no `engine/` paths)

## Completion Checklist
- [ ] Code follows discovered patterns (BRACE_STYLE, REGISTRY_RELAY, SCENE_DATA_DEFAULTING, APPLY_AND_SYNC_REUSE, MAIN_MENU_SCREEN_STRUCTURE, HUD_PROP_THREADING)
- [ ] No error handling added beyond what already exists — `chooseMove` cannot throw on a legal call (Phase 1 guarantee), `applyAndSync` already handles all state transitions
- [ ] No hardcoded well-mode assumptions introduced (this phase's code is mode-agnostic — it wires `opponentType` generically, same as `modeId` already is)
- [ ] No unnecessary scope additions — no difficulty parameter, no color-choice UI, no new test infrastructure, no fastest-win tie-break
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A human moves the AI's pebble before the turn-gating guard lands (race between tap and `applyAndSync`'s synchronous `EventBus.emit`) | L — `applyAndSync` and `onVertexTap` are both synchronous, single-threaded; no `await` between the state flip and the guard becoming effective | Guard checks `this.state.current` directly (always current by the time any tap handler runs), not a stale snapshot |
| `maybeScheduleAiMove`'s `delayedCall` fires after the scene has been destroyed (e.g. user hits Menu mid-AI-think) | L-M — Phaser scenes typically clean up their own timers on shutdown, but not guaranteed for a manually-tracked callback if the scene object itself is torn down by `PhaserGame`'s `game.destroy(true)` | `game.destroy(true)` (already called in `PhaserGame.tsx`'s cleanup, unchanged this phase) destroys all scenes and their `time` clocks; no separate cleanup needed. Flag for manual playtest: hit Menu while "thinking..." is showing, confirm no console error. |
| `opponentType` desyncs from `modeId` across a Menu round-trip (stale state bug) | L — explicitly guarded (Task 6 GOTCHA) | `toMenu` resets both together, single source of truth |
| Forgetting the `refreshDraggable` guard and only adding the `onVertexTap` guard | M if rushed — visually, AI's pebble would still lift under a human's drag before snapping back | Both guards are separate IMPLEMENT blocks in Task 2; Edge Cases Checklist calls out "AI's own pebble must not be draggable" as its own item |

## Notes
- This phase is pure wiring — `ai.ts` itself (Phase 1) is not touched or re-verified; its correctness is already proven by `ai.test.ts`.
- After this plan is implemented and its validation commands pass (plus the manual browser playtest), update the PRD's Phase 2 row from `pending` to `complete`, and update the PRD's own Success Metrics status if desired — this closes out the PRD's only two implementation phases.
- The two still-open PRD Open Questions (fastest-win/slowest-loss tie-break; exact AI delay tuning) remain genuinely open after this phase — `aiMoveDelayMs: 400` is a reasonable default, not a researched-optimal value, and the tie-break clause is explicitly not implemented (see NOT Building).
