# Plan: Drag-to-Move Pebbles (Pebble Trap)

## Summary
Make placed pebbles draggable during the movement phase, as a second **input method** feeding the exact same `onVertexTap` state machine a tap already drives. One file changes: `src/game/scenes/BoardScene.ts`. Every event-ordering claim below was independently re-derived from Phaser 4.0.0's actual shipped source during planning (not just carried over from the PRD) — see External Documentation for line-level citations, including one gotcha the PRD's illustrative code didn't surface (a TypeScript strict-null-check issue) and one gotcha for the browser validation script itself (`event.buttons` on synthetic `mousemove`).

## User Story
As a hotseat player, I want to press-drag-release my own pebble during my move, so it feels like sliding a physical board piece instead of two separate taps.

## Problem → Solution
Movement today is tap-select-then-tap-destination only → pebbles become draggable (press to select + follow the pointer + release to commit), while tap-to-move keeps working completely unchanged, both permanently coexisting.

## Metadata
- **Complexity**: Medium (single file, but the event-ordering semantics are subtle and previously got a first-draft PRD wrong twice — see PRD's Research Summary. Low file-count, high correctness-risk-per-line.)
- **Source PRD**: `.claude/PRPs/prds/drag-to-move.prd.md`
- **PRD Phase**: 1 — Drag-to-move (the only phase)
- **Estimated Files**: 1 (update)

---

## UX Design

### Before
```
Movement phase, your turn:
  tap your pebble  -> ring + legal-destination dots appear
  tap a destination -> pebble tweens there, turn advances
  tap anything else  -> deselects
```

### After
```
Movement phase, your turn — BOTH still work:
  tap your pebble  -> ring + legal-destination dots appear (unchanged)
  tap a destination -> pebble tweens there, turn advances (unchanged)

  press your pebble -> ring + legal-destination dots appear (same select)
  drag              -> pebble follows the pointer live
  release on a legal dot   -> pebble settles there, turn advances
  release anywhere else    -> pebble tweens back to origin, deselects
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Press own pebble, movement phase | (no press-specific behavior; only full tap) | selects it — ring + legal-dest highlights, identical to a tap | comes free: `pointerdown` already calls `onVertexTap` |
| Drag pebble | n/a | pebble visually follows the pointer (world-space `dragX`/`dragY`) | no engine call during drag itself — only on release |
| Release over legal destination's hit-circle | n/a | move executes via `onVertexTap`, pebble settles (tween), turn advances | identical trap/draw/win detection to tap-move |
| Release over illegal-but-in-range vertex | n/a | `onVertexTap` no-ops/deselects, pebble snaps back to origin | handled in the `drop` listener |
| Release off every drop zone (open board area) | n/a | pebble snaps back to origin, selection clears | handled in the `dragend` listener, gated by `didDrag` |
| Opponent's pebble, any phase | tap deselects (not owned) | press still deselects (not owned); it is never draggable so a drag gesture on it produces no movement at all | `refreshDraggable` never marks it draggable |
| Any pebble during placement/gameover | n/a (no pebbles exist yet / input locked) | never draggable | `refreshDraggable`'s condition is `phase === 'movement'` |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/drag-to-move.prd.md` | 66–144 (Solution Detail / Rules) | the normative spec this plan implements — two load-bearing facts, event wiring code, 6-case trace |
| P0 | `src/game/scenes/BoardScene.ts` | 1–266 (full file, current) | file being modified; every method below references its current line numbers |
| P0 | `src/game/render/theme.ts` | 1–14 | `THEME.pebbleRadius`, `THEME.tapRadius`, `THEME.moveTweenMs` — reused as-is, no new tokens needed |
| P1 | `src/game/engine/types.ts` | 1–32 | `VertexId` (= `string`), `Move`, `GameState` — only types this file touches |
| P1 | `src/game/modes/well/index.ts` | 1–32 | live vertex coordinates for the browser validation script below (`C(360,560) N(360,290) E(630,560) S(360,830) W(90,560)`) |
| P2 | `.claude/PRPs/reports/phase-4-interaction-flow-report.md` | "Deviations" section | standing gotcha: no runtime `Phaser` global (type positions only); synthetic `PointerEvent` does not reach Phaser's input — must dispatch native `MouseEvent` |
| P2 | `src/game/main.ts` | 1–33 | `width:720, height:1280`, `Scale.FIT` + `CENTER_BOTH` — needed to convert design coords to CSS pixel coords in the browser script |

## External Documentation

All of the below were read directly from `node_modules/phaser/src/...` during this planning pass (not docs, not the PRD's citations alone — independently re-derived and, in two cases, extended beyond what the PRD cited).

| Topic | Source | Key Takeaway |
|---|---|---|
| `dragstart`/`dragend` fire regardless of movement | `InputPlugin.js:1282–1288` (`processDragDownEvent`) | With `dragDistanceThreshold`/`dragTimeThreshold` both at their default of 0, drag state jumps straight to "actively dragging" **on the down event itself**, before any movement. This is *why* `dragend` later fires unconditionally on release (confirmed next row) — not an incidental detail, a direct mechanical consequence. |
| `dragend` fires on every release; `dropped` reflects whether a zone was hit | `InputPlugin.js:1464–1511` (`processDragUpEvent`) | The per-object `dragState === 2` check that gates emitting `dragend` is satisfied by *every* press (see previous row), so `dragend` is unconditional. `dropped` starts `false` and only flips `true` if `input.target` was set — which only happens inside `processDragMoveEvent`, i.e. only after a real move-over-a-zone. A plain tap: `dragend` fires, `dropped:false`. Confirms PRD fact #1 from the opposite direction (down-side mechanics vs. up-side mechanics). |
| `setInteractive({dropZone:true})` is a no-op on an already-interactive object | `InputPlugin.js:930–951` (`enable`) + `InputPlugin.js:2357–2404` (`setHitArea`) | `enable()`'s own `dropZone` parameter is a *separate* positional slot from a `dropZone` key living inside a config-object `hitArea` argument. The config-object's `dropZone` key is read **only** inside `setHitArea()` (line 2394, `GetFastValue(config, 'dropZone', false)`) — and `setHitArea()` is only called from `enable()`'s `else` branch, i.e. only when the object does **not** already have `.input` (line 934–943). Our hit-circles already have `.input` by the time this would run, so the config object's key is never even read. Independently confirms the PRD's finding via the exact branch that skips it, not just the symptom. |
| Correct fix: direct property set | `InputPlugin.js:984` (`hitTestPointer`, reads `obj.input.dropZone`) | Confirms the flag consumed at hit-test time is a plain property on `.input`, reachable by direct assignment regardless of how `.input` was created. |
| `setDraggable` requires pre-existing `.input` | `InputPlugin.js:2261–2289` | `gameObject.input.draggable = value` is unconditional — no null guard. Calling `setDraggable` before `setInteractive` throws. Confirms PRD's ordering requirement. |
| `GameObject.getData` return type | `node_modules/phaser/types/phaser.d.ts:24835` | `getData(key: string \| string[]): any`. Passing its result to a `VertexId`-typed (`string`) parameter compiles with zero cast needed — `any` bypasses the check. The PRD's illustrative code relies on this; confirmed it's not accidentally relying on unsound typing. |
| `GameObject.input` is nullable in the type system | `node_modules/phaser/types/phaser.d.ts:24674` | `input: Phaser.Types.Input.InteractiveObject \| null`. This project's `tsconfig.json` has `strict: true` (verified), so `hit.input.dropZone = true` **will not typecheck** as a bare expression — needs an `if (hit.input) {...}` guard first (see Task 1). This is a real gotcha the PRD's illustrative snippet doesn't show, because the PRD's code block was demonstrating event semantics, not literal drop-in TypeScript. |
| `InteractiveObject.dropZone` field shape | `node_modules/phaser/types/phaser.d.ts:95310–95326` | `dropZone: boolean` — required, non-optional. Confirms the direct-assignment fix is fully type-sound once `.input` is narrowed non-null. |
| Exact event name strings | `node_modules/phaser/src/input/events/GAMEOBJECT_{DRAG,DRAG_END,DROP,POINTER_DOWN,DRAG_START}_EVENT.js` | `'drag'`, `'dragend'`, `'drop'`, `'pointerdown'`, `'dragstart'` — confirmed literal, matches the PRD's code block exactly. |
| Synthetic `mousemove` must set `event.buttons` | `node_modules/phaser/src/input/Pointer.js:691–695` (`move`) | `Pointer.move()` sets `this.buttons = event.buttons` from the native event. A synthetic `MouseEvent('mousemove', {clientX, clientY})` with no `buttons` key defaults to `0`, which Phaser reads as "not pressed" — this would silently break the browser validation script's simulated drag (a **test-script** bug, not a product bug, but it would look exactly like "drag doesn't work"). **New finding this session, not documented anywhere yet** — see Validation Commands GOTCHA below. |
| Mouse events bind to the canvas element | `node_modules/phaser/src/input/mouse/MouseManager.js:254, 470–472` | `target = game.canvas` by default; `mousedown`/`mousemove`/`mouseup` all listen there. Confirms the browser script should dispatch on `document.querySelector('canvas')`, matching phase 4's proven technique — and confirms an "off-zone" release point can stay safely inside canvas bounds (no need to leave the canvas to test "released off any zone"). |

---

## Patterns to Mirror

### HIT_AREA_LOCAL_SPACE (existing, phase 4)
// SOURCE: `src/game/scenes/BoardScene.ts:130–145` (`createVertexHitAreas`)
```ts
hit.setInteractive(
    new Geom.Circle(THEME.tapRadius, THEME.tapRadius, THEME.tapRadius),
    Geom.Circle.Contains
);
```
Local-space `(r, r, r)` for any centered-origin Arc, regardless of actual radius. Reused verbatim for the pebble's own hit area (Task 3), just swapping `THEME.tapRadius` → `THEME.pebbleRadius`.

### NO_RUNTIME_PHASER_GLOBAL (existing, phases 1/3/4 — a repeat offender)
// SOURCE: `src/game/scenes/BoardScene.ts:1` (`import { Geom, Scene } from 'phaser';`)
Only `Geom` and `Scene` are imported because those are the only two used as **runtime values**. `Phaser.GameObjects.Arc`, `Phaser.Input.Pointer`, `Phaser.GameObjects.GameObject`, `Phaser.GameObjects.Graphics` all appear in this file already as **type-only** positions (parameter annotations, field types) with no import — safe because they're ambient global types from Phaser's `.d.ts`, not runtime lookups. This plan adds more type-only `Phaser.Input.Pointer` / `Phaser.GameObjects.GameObject` annotations (Task 2) — zero new imports required. Do not import `Phaser` as a value for these.

### STATE_CHANGE_CHOKEPOINT (existing, phase 4)
// SOURCE: `src/game/scenes/BoardScene.ts:239–244` (`applyAndSync`)
Every state mutation goes through one function that syncs visuals, updates engine state, and notifies React, in that exact order (visuals depend on pre-move state, so they must run first). This plan adds a fourth step (`refreshDraggable`) to this SAME chokepoint plus to `restartGame`'s reset — never a new parallel state-change path.

### DATA_TAG vs CLOSURE_CAPTURE (new pattern this phase, but same file)
The hit-circles use a closure-captured `v.id` in their `pointerdown` handler (line 143) — correct because hit-circles are created once and never move. Pebbles DO move (re-keyed in `pebbleObjects` on every successful move), so their handlers must read `.getData('vertexId')` at call time, never a captured variable. Both patterns coexist in the same file for a documented reason — do not "unify" them.

### CODE_STYLE (existing)
4-space indent, single quotes, semicolons, brace-on-own-line for this file's class/method bodies. `private` methods after the `public` ones that use them, except where an existing method is defined further down and called from above (already true of `renderHighlights`, called by `restartGame` above it in file order — an established, acceptable pattern in this exact file).

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/game/scenes/BoardScene.ts` | UPDATE | pebble interactivity + draggability, drop-zone flag on existing hit-circles, drag/drop/dragend event wiring, snap-back helper, full-sweep draggability refresh |

## NOT Building
- Drag-to-place during placement — no pebble exists yet to drag; placement stays tap-only (PRD).
- Removing tap-to-move — both coexist permanently (PRD, user decision).
- Live "can't drop here" visual cue while hovering an illegal zone mid-drag (PRD — Could, deferred).
- Pebble lift/scale effect while dragging (PRD — Could, deferred).
- Any change to `engine/`, `modes/well/`, `modes/registry.ts`, `ui/Hud.tsx`, `public/style.css` — this is 100% input-layer, reusing `onVertexTap` end to end.
- Any new unit tests — this is UI/interaction wiring over an already-tested engine, mirroring phase 4's precedent exactly (browser script is the functional test, not vitest).

---

## Step-by-Step Tasks

### Task 1: `createVertexHitAreas` — mark existing hit-circles as drop zones
- **ACTION**: extend the existing per-vertex hit-circle setup (currently `src/game/scenes/BoardScene.ts:130–145`) to also act as a drag drop-zone and carry its vertex id as data.
- **IMPLEMENT**: insert after the existing `hit.setInteractive(...)` call, before the existing `hit.on('pointerdown', ...)` line:
```ts
//  Direct property set — setInteractive({ dropZone: true }) is a silent
//  no-op on an object that already has .input (verified against Phaser
//  4.0.0 source: the config-object's dropZone key is read only inside
//  setHitArea(), which enable() skips whenever .input already exists —
//  exactly this case, since setInteractive() was just called above).
//  This does NOT disable ordinary tap behavior — dropZone is additive.
if (hit.input)
{
    hit.input.dropZone = true;
}
hit.setData('vertexId', v.id);
```
- **MIRROR**: HIT_AREA_LOCAL_SPACE (this task only adds to the existing block, doesn't touch the `setInteractive(...)` call itself).
- **IMPORTS**: none new.
- **GOTCHA**: the `if (hit.input)` guard is NOT a real defensive check — `.input` is guaranteed non-null immediately after `setInteractive()` on the line above (Phaser creates it synchronously). The guard exists purely because `GameObject.input` is typed `InteractiveObject | null` and this project's `tsconfig.json` has `strict: true` — a bare `hit.input.dropZone = true` fails `tsc --noEmit`. Do not "simplify" this to a non-null assertion (`hit.input!.dropZone = true`) — this codebase has zero non-null-assertion expressions anywhere; the explicit `if` guard matches its existing style (e.g. `if (!circle) { return; }` in `syncPebbles`).
- **VALIDATE**: `npm run typecheck` (zero errors expected after this task alone).

### Task 2: add `wirePebbleEvents` and `snapPebbleToVertex` private methods
- **ACTION**: add two new private methods to `BoardScene`. Placement: after `clearSelection` (current lines 200–205), before `syncPebbles` (current line 210) — `syncPebbles` will call `wirePebbleEvents` once Task 3 rewrites it, so it must be defined above that call site or below it (either compiles fine in a class body — placing it just above matches this file's existing convention of defining a helper near its first use).
- **IMPLEMENT**:
```ts
//  Wired once per pebble, at creation. Drag is a second INPUT METHOD
//  feeding the same onVertexTap state machine a tap already drives —
//  never a second decision system.
//
//  didDrag distinguishes a real cancelled drag from a plain tap: dragend
//  fires on EVERY press/release pair (including zero-movement taps, with
//  dropped:false there too — verified against Phaser 4.0.0 source,
//  InputPlugin.js processDragUpEvent), so dropped alone can't tell them
//  apart. didDrag is set ONLY inside 'drag', which fires ONLY after real
//  pointer movement.
private wirePebbleEvents (pebble: Phaser.GameObjects.Arc)
{
    let didDrag = false;

    pebble.on('pointerdown', () =>
    {
        didDrag = false;
        this.onVertexTap(pebble.getData('vertexId'));
    });

    pebble.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) =>
    {
        didDrag = true;
        pebble.x = dragX;
        pebble.y = dragY;
    });

    pebble.on('drop', (_pointer: Phaser.Input.Pointer, dropZone: Phaser.GameObjects.GameObject) =>
    {
        const originVertexId = pebble.getData('vertexId');
        const targetVertexId = dropZone.getData('vertexId');
        this.onVertexTap(targetVertexId);
        //  onVertexTap only relocates the pebble in pebbleObjects on a
        //  LEGAL move; if it's still registered at its own origin,
        //  nothing moved (illegal target) — snap the VISUAL position
        //  back. syncPebbles' own tween already handles the legal-move
        //  case, so no `else`.
        if (this.pebbleObjects[originVertexId] === pebble)
        {
            this.snapPebbleToVertex(pebble, originVertexId);
        }
    });

    pebble.on('dragend', (_pointer: Phaser.Input.Pointer, _dragX: number, _dragY: number, dropped: boolean) =>
    {
        //  Fires on EVERY press/release, including a plain tap
        //  (dropped=false there too) — didDrag distinguishes "real drag
        //  released off any zone" from "just a tap". A drop that landed
        //  on SOME zone is fully handled by 'drop' above; don't
        //  double-handle it here.
        if (didDrag && !dropped)
        {
            this.snapPebbleToVertex(pebble, pebble.getData('vertexId'));
            this.clearSelection();
        }
    });
}

private snapPebbleToVertex (pebble: Phaser.GameObjects.Arc, vertexId: VertexId)
{
    const pos = this.vertexPos[vertexId];
    this.tweens.add({
        targets: pebble,
        x: pos.x,
        y: pos.y,
        duration: THEME.moveTweenMs,
        ease: 'Quad.easeInOut'
    });
}
```
- **MIRROR**: NO_RUNTIME_PHASER_GLOBAL (`Phaser.Input.Pointer` / `Phaser.GameObjects.GameObject` are type-only, no import); the tween shape in `snapPebbleToVertex` mirrors the existing tween in `syncPebbles` (current lines 230–236) exactly — same duration token, same ease string.
- **IMPORTS**: none new.
- **GOTCHA**: all four `.on(...)` callbacks are arrow functions specifically so `this` inside them refers to the `BoardScene` instance (lexical capture from `wirePebbleEvents`'s own `this`), not the pebble. Do not convert to `function` expressions.
- **GOTCHA**: `pebble.getData('vertexId')` and `dropZone.getData('vertexId')` both return `any` (confirmed: `GameObject.getData(key): any` in Phaser's `.d.ts`) — this is why no cast to `VertexId` is needed for `onVertexTap(...)` to accept them; `tsc --noEmit` passes as-is.
- **VALIDATE**: `npm run typecheck` (these methods aren't called yet after this task — must compile standalone with zero errors; unused-method warnings are not a `tsc --noEmit` failure, only `noUnusedLocals`/`noUnusedParameters` for *local* bindings, which don't apply to class methods).

### Task 3: rewrite `syncPebbles` — interactivity, data tag, event wiring on creation; data tag refresh on relocation
- **ACTION**: replace the current `syncPebbles` method (lines 210–237) in full.
- **IMPLEMENT**:
```ts
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
        circle.setData('vertexId', move.to);
        //  Own hit area sized to the pebble itself — same verified
        //  local-space pattern as the vertex hit-circles (correct for
        //  any centered-origin Arc regardless of its radius).
        circle.setInteractive(
            new Geom.Circle(THEME.pebbleRadius, THEME.pebbleRadius, THEME.pebbleRadius),
            Geom.Circle.Contains
        );
        this.wirePebbleEvents(circle);
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
    //  Pebbles are re-keyed across vertices as they move — this data tag
    //  must be kept current on EVERY relocation, not just creation, or
    //  event handlers reading it via getData() go stale after a pebble's
    //  first move (unlike the hit-circles, which never move and can
    //  safely use a creation-time closure instead — see DATA_TAG vs
    //  CLOSURE_CAPTURE).
    circle.setData('vertexId', move.to);
    const dest = this.vertexPos[move.to];
    this.tweens.add({
        targets: circle,
        x: dest.x,
        y: dest.y,
        duration: THEME.moveTweenMs,
        ease: 'Quad.easeInOut'
    });
}
```
- **MIRROR**: HIT_AREA_LOCAL_SPACE for the new `setInteractive` call; the move-branch tween is untouched from the current file except for the one inserted `setData` line.
- **IMPORTS**: none new (`Geom` already imported at the top of the file).
- **GOTCHA**: `setInteractive` MUST be called before `wirePebbleEvents`/before any future `setDraggable` — `setDraggable` throws on an object with no `.input` yet. The order in the snippet above is already correct; do not reorder.
- **GOTCHA**: this does NOT set the pebble draggable — only interactive. Draggability is a separate, later toggle (Task 4/5) so that freshly-placed pebbles during placement phase are interactive (for future movement-phase use) but not yet draggable.
- **VALIDATE**: `npm run typecheck`.

### Task 4: add `refreshDraggable` private method
- **ACTION**: add a new private method, placed after `syncPebbles` (which it does not call and is not called by), before `applyAndSync` (current line 239) — its two call sites are added in Task 5.
- **IMPLEMENT**:
```ts
//  Full sweep, every state change — never "enable the mover's pebbles",
//  which would leave the PREVIOUS player's pebbles still draggable.
//  setDraggable requires the target to already be interactive (throws
//  otherwise) — safe here because syncPebbles makes every pebble
//  interactive at creation, unconditionally, before this can ever run
//  against it.
private refreshDraggable ()
{
    for (const key of Object.keys(this.pebbleObjects) as VertexId[])
    {
        const pebble = this.pebbleObjects[key];
        if (!pebble)
        {
            continue;
        }
        const draggable = this.state.phase === 'movement' && this.state.board[key] === this.state.current;
        this.input.setDraggable(pebble, draggable);
    }
}
```
- **MIRROR**: the `Object.keys(this.pebbleObjects) as VertexId[]` iteration pattern is copied verbatim from `restartGame`'s existing destroy-loop (current lines 83–86).
- **IMPORTS**: none new.
- **GOTCHA**: `key` here IS the pebble's current vertex id — `pebbleObjects` is kept re-keyed to the CURRENT vertex on every move (both in the existing move-branch of `syncPebbles` and unchanged by this plan), so `this.state.board[key]` correctly reads "who currently occupies the vertex this pebble object is at" without needing `.getData()` — the dict key is already the authoritative current-vertex-id for this specific loop. (`.getData('vertexId')` dynamic-read is only required inside event handlers that fire asynchronously later, per DATA_TAG vs CLOSURE_CAPTURE — this loop runs synchronously against the current mapping, so the dict key is sufficient here.)
- **GOTCHA**: `this.input` is the SCENE's `InputPlugin` (`Scene.input`), always non-null — not the same as `pebble.input` (nullable, per-object). No guard needed here, unlike Task 1.
- **VALIDATE**: `npm run typecheck`.

### Task 5: wire `refreshDraggable()` into `applyAndSync` and `restartGame`
- **ACTION**: two one-line insertions.
- **IMPLEMENT** — in `applyAndSync` (current lines 239–244), insert before the final `EventBus.emit(...)` line:
```ts
private applyAndSync (move: Move)
{
    this.syncPebbles(move);
    this.state = applyMove(this.mode.engine, this.state, move);
    this.refreshDraggable();
    EventBus.emit('game-state-changed', this.getSnapshot());
}
```
- **IMPLEMENT** — in `restartGame` (current lines 81–93), insert before the final `EventBus.emit(...)` line:
```ts
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
    this.refreshDraggable();
    EventBus.emit('game-state-changed', this.getSnapshot());
}
```
- **MIRROR**: STATE_CHANGE_CHOKEPOINT — `EventBus.emit(...)` stays the LAST line of both methods, matching the existing convention in this file (also true of `create()`'s `current-scene-ready` emit).
- **IMPORTS**: none new.
- **GOTCHA**: in `restartGame`, `pebbleObjects` is already empty by the time `refreshDraggable()` runs (all pebbles destroyed above) — this call is a harmless no-op today, included only for normative consistency (PRD: "after `restartGame` resets state") and as a defensive habit if a future change ever reorders the destroy loop.
- **GOTCHA**: `refreshDraggable()` must run AFTER `this.state = applyMove(...)` in `applyAndSync` — it reads the NEW `state.phase`/`state.current`, not the pre-move one. The snippet above already has the correct order; do not move it above the `this.state = ...` line.
- **VALIDATE**: `npm run typecheck && npm test` (22/22 must stay green — zero engine code touched this phase).

### Task 6: validation sweep (static + regression + browser)
- **ACTION**: run every validation level, in order, fixing forward before proceeding to the next.
- **VALIDATE**:
```bash
npm run typecheck                                              # 0 errors
npm test                                                        # 22/22 green — engine untouched
npm run build                                                   # clean
git diff --stat -- src/game/engine src/game/modes src/ui public # MUST be empty — this phase touches BoardScene.ts only
npm run dev                                                      # http://localhost:8080, then browser-validate below
```

Browser validation (REQUIRED — new input mechanism, not covered by any existing test):

**Setup helper** — paste once per fresh tab, before any interaction. Converts design-space vertex coordinates (from `src/game/modes/well/index.ts`) to CSS client coordinates, and dispatches native `MouseEvent`s on the canvas (Phaser's `MouseManager` binds to `game.canvas`, not `window`/`document` — confirmed in External Documentation above; synthetic `PointerEvent` does NOT reach Phaser's input, per phase 4's prior finding):
```js
window.__dragTest = (() => {
    const V = { C: [360, 560], N: [360, 290], E: [630, 560], S: [360, 830], W: [90, 560] };
    const canvas = document.querySelector('canvas');
    function toClient([x, y]) {
        const r = canvas.getBoundingClientRect();
        return [r.left + x * (r.width / 720), r.top + y * (r.height / 1280)];
    }
    function fire(type, [x, y], buttons) {
        canvas.dispatchEvent(new MouseEvent(type, {
            clientX: x, clientY: y, buttons, bubbles: true, cancelable: true, view: window
        }));
    }
    //  drag(fromKey, toXY): press on a named vertex, move to an explicit
    //  [x,y] design-space point (may be a named vertex's coords, or any
    //  arbitrary off-zone point), release there.
    function drag(fromKey, toXY) {
        const from = toClient(V[fromKey]);
        const to = toClient(toXY);
        fire('mousedown', from, 1);
        fire('mousemove', to, 1);   // GOTCHA: buttons:1 required — Pointer.move()
        fire('mousemove', to, 1);   // reads event.buttons; omitting it reads as
        fire('mouseup', to, 0);     // "not pressed" and silently breaks the drag.
    }
    function tap(key) {
        const p = toClient(V[key]);
        fire('mousedown', p, 1);
        fire('mouseup', p, 0);
    }
    return { V, toClient, drag, tap };
})();
```
GOTCHA (already flagged in External Documentation, repeated here because it's easy to drop when copy-pasting): every synthetic `mousemove` while a button is conceptually "held" MUST include `buttons: 1`. Its absence defaults to `0`, which `Pointer.move()` reads as released — Phaser will not treat it as an active drag, `'drag'` will never fire, and the symptom ("pebble doesn't follow the pointer") will look exactly like a product bug. It is not one — verify this helper's `buttons` values match the snippet above before concluding anything is broken.

1. Open a **fresh** tab (cache-busted) at `http://localhost:8080`. Console must show zero errors. Paste the setup helper above.
2. **Placement** (reuses phase 4's exact proven non-trapping sequence): `__dragTest.tap('N')` (red), `__dragTest.tap('S')` (blue), `__dragTest.tap('C')` (red), `__dragTest.tap('W')` (blue). Board is now `{N:1, S:2, C:1, W:2, E:null}`, HUD reads "Red: move a pebble". (All four via plain tap — confirms tap-to-place is untouched and gets us to movement phase fast.)
3. **Drag → legal destination**: `__dragTest.drag('C', __dragTest.V.E)`. Expect: pebble visibly slides from C to E over the drag, HUD flips to "Blue: move a pebble", console clean. This is the ONLY legal move available to either red pebble in this position (C and N are both adjacent to the sole empty vertex E) — re-derived from `legalMoves` by hand during planning, not guessed.
4. **Drag → illegal-but-zoned target**: it's now Blue's turn. `__dragTest.drag('W', __dragTest.V.C)` — C is occupied by Red, a real drop zone but an illegal destination. Expect: pebble snaps back to W (tween), no turn change, HUD still reads Blue's turn, console clean. This exercises the `drop`-handler snap-back path specifically (not the `dragend` path — a zone WAS hit).
5. **Drag → released off every zone**: `__dragTest.drag('W', [500, 420])` — `(500,420)` is design-space, comfortably >48px (`THEME.tapRadius`) from all five vertices (nearest is N at distance ≈191px). Expect: pebble snaps back to W (tween), selection clears (highlight ring disappears), no turn change. This exercises the `dragend`-handler snap-back path specifically (`drop` never fires — no target was ever set).
6. **Opponent pebble is never draggable**: still Blue's turn. Attempt `__dragTest.drag('N', __dragTest.V.E)` — N holds Red's pebble, not Blue's. Expect: pebble at N does not move at all during the simulated drag (not in Phaser's draggable list), and since N isn't Blue's own piece, `onVertexTap` just deselects — no ring, no state change, console clean.
7. **Plain tap still works after drag exercises above (regression)**: `__dragTest.tap('W')` (Blue's own pebble — selects, ring should appear over W). Then `__dragTest.tap` the currently-empty legal destination reported by the ring (cross-check against `legalMoves` by hand if unsure) to confirm a full tap-only move still completes normally, HUD advances turn.
8. **Full phase-4 regression replay**: with a fresh reload, re-run phase-4 plan's Task 6 steps 1–8 verbatim (`.claude/PRPs/plans/completed/phase-4-interaction-flow.plan.md`, lines 615–625) — T4 movement-trap, T7 placement-trap, restart-twice, selection UX, narrow-viewport HUD alignment. All via plain tap, zero drag involved. Every one must still pass unchanged.
9. **Drag into a trap / draw** (spot-check, not exhaustive): from a fresh game, place a trapping sequence via `__dragTest.tap(...)` up to the final movement, then execute that final trapping move via `__dragTest.drag(...)` instead of tap. Confirm the win overlay appears exactly as it does for a tap-triggered trap (same code path — `onVertexTap` doesn't know or care which input method called it — this step is a spot-check of that claim, not a new code path to debug if it fails).

---

## Testing Strategy

### Unit Tests
None planned. This phase is pure input/rendering wiring over an already-tested, untouched engine (22 tests from prior phases remain the regression gate). Mirrors phase 4's precedent exactly — see its report's "Tests Written" section for the same reasoning.

### Edge Cases Checklist
- [x] Drag own pebble to the (only) legal destination — Task 6 step 3
- [x] Drag own pebble to an illegal but zoned (occupied) vertex — Task 6 step 4
- [x] Drag own pebble and release in open board space, off every zone — Task 6 step 5
- [x] Attempt to drag an opponent's pebble — Task 6 step 6
- [x] Plain tap still works after drag exercises (no leaked `didDrag`/selection state) — Task 6 step 7
- [x] Full existing tap regression suite (T4, T7, restart×2, selection UX, narrow viewport) — Task 6 step 8
- [x] Drag-triggered trap/draw shows the correct HUD overlay — Task 6 step 9
- [x] Pebbles placed during placement phase are not draggable (implicit — `refreshDraggable`'s `phase === 'movement'` condition, exercised naturally by step 2 using taps only for all placements; not independently drag-tested since there's nothing to drag onto an empty board)

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: Zero type errors.

### Unit Tests
```bash
npm test
```
EXPECT: 22/22 pass, unchanged from before this phase.

### Full Test Suite
Same command as above — this project has one test suite (`vitest run` via `npm test`), no separate "full" tier.

### Build
```bash
npm run build
```
EXPECT: clean Vite production build.

### Engine-Frozen Check
```bash
git diff --stat -- src/game/engine src/game/modes src/ui public
```
EXPECT: empty output — this phase touches `src/game/scenes/BoardScene.ts` only.

### Browser Validation
```bash
npm run dev   # http://localhost:8080
```
EXPECT: Task 6's full 9-step script passes, zero console errors throughout.

### Manual Validation
- [ ] All 9 browser-validation steps in Task 6 pass
- [ ] `git diff --stat -- src/game/scenes/BoardScene.ts` shows the expected shape: `createVertexHitAreas` +5/-0ish, two new methods, `syncPebbles` rewritten, `refreshDraggable` new, two one-line insertions — no unrelated churn

---

## Acceptance Criteria
- [ ] All 6 tasks completed
- [ ] All validation commands pass
- [ ] No type errors, no engine/mode/UI diff
- [ ] Full game playable start-to-finish using ONLY drag (Task 6 steps 2–5 chain into a real game, modulo step 2 using tap for placement per PRD's explicit scope — placement stays tap-only, not a gap)
- [ ] Full game playable start-to-finish using ONLY tap, unchanged (Task 6 step 8)
- [ ] Matches UX design table above

## Completion Checklist
- [ ] Code follows discovered patterns (HIT_AREA_LOCAL_SPACE, NO_RUNTIME_PHASER_GLOBAL, STATE_CHANGE_CHOKEPOINT, DATA_TAG vs CLOSURE_CAPTURE)
- [ ] No non-null assertions introduced (guard-based null narrowing only, per Task 1's GOTCHA)
- [ ] No hardcoded board/vertex constants outside the browser validation script (which is test tooling, not product code — the `V` map there mirrors `well/index.ts`'s data for convenience, it does not duplicate it INTO product code)
- [ ] Tests follow test patterns — N/A, no new tests this phase (see Testing Strategy)
- [ ] No unnecessary scope additions — zero engine/HUD/CSS changes
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Implementer reverts to `setInteractive({dropZone:true})` or a dragend-always-clears design | L | H (silent — drops keep failing or taps keep deselecting, no console error) | both wrong forms named explicitly in Task 1/PRD, working replacement given verbatim; Task 6 step 4/5 would immediately surface either regression as a failed snap-back or failed select |
| `hit.input.dropZone = true` fails `tsc --noEmit` under `strict: true` if the `if (hit.input)` guard is dropped | M (easy to "simplify" away, looks redundant) | M (typecheck failure, caught immediately by Task 1's own VALIDATE step) | GOTCHA explicitly explains WHY the guard exists (compile-time only, not a real runtime possibility) so it isn't mistaken for dead code |
| Browser validation script silently fails to simulate a real drag (`event.buttons` omitted on synthetic `mousemove`) | M (new gotcha, not previously documented anywhere in this project) | M (looks exactly like "drag doesn't work" — a debugging detour into product code for a test-script bug) | called out twice in Task 6 (setup helper comment + inline GOTCHA), with the exact source line (`Pointer.js:691–695`) that explains the mechanism |
| Stale `vertexId` after a pebble moves (closure-capture mistake) | L (explicit contrast with the hit-circle pattern is spelled out in Task 3 and the DATA_TAG pattern) | H if it happens (drag would silently target the WRONG vertex after a pebble's first move) | Task 3's snippet updates `.setData('vertexId', ...)` on every relocation, not just creation; Task 6 step 3 exercises a pebble's first move via drag, which would surface this immediately if missed |
| Draggable flag not refreshed on turn change → wrong player can drag | L (single chokepoint, Task 5) | H if it happens | `refreshDraggable()` tied to the same chokepoint as every other state-derived sync (`applyAndSync`, `restartGame`); Task 6 step 6 exercises this directly |
| Regression in existing tap flow | L (zero new decision logic — drag is purely an alternate way to call `onVertexTap`) | H if it happens (this is the shipped game, not a toy) | Task 6 step 8 re-runs phase 4's full validation script verbatim |

## Notes
- After validation: commit as `feat: add drag-to-move for pebbles` (conventional commit, no co-author trailer per standing preference).
- This is the PRD's only phase — after this, `drag-to-move.prd.md` is fully complete (mirrors `draw-by-repetition.prd.md`'s two-phase completion pattern: update the PRD's phase table to `complete` with this plan + the eventual report linked, in the same pass as `/prp-implement`'s own report-writing step).
- Confidence for single-pass implementation: **9/10**. The one point held back is the browser-validation environment itself — even after proactively resolving the `event.buttons` gotcha found during this planning pass, synthetic multi-event gestures (mousedown→mousemove→mouseup) are inherently more surface area than the single synthetic click phase 4 validated, and *something* in that surface area could still surprise us empirically the way `PointerEvent`-vs-`MouseEvent` did last time. If it does, it is very likely a test-harness quirk, not a product bug — check the console and the actual pebble position/HUD state before assuming the implementation is wrong.
