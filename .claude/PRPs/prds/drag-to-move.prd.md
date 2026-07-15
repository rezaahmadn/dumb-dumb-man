# Drag-to-Move Pebbles (Pebble Trap)

Adds pointer/touch drag as an alternate way to move a placed pebble during the movement phase, alongside the existing tap-select-then-tap-destination flow. Extends the shipped `pebble-trap` game. Normative spec, written so a smaller model can implement without guessing.

## Problem Statement

Reza and a second player use tap-select-then-tap-destination to move pebbles today. That works, but doesn't feel like moving a physical board piece — you touch the piece, then touch somewhere else, with a highlight in between. Cost of not solving: nothing broken, purely a feel/interaction-quality gap for a board game whose whole premise is a physical piece on a physical board.

## Evidence

Assumption — this is a personal project (Reza + one other hotseat player, no external users), so there's no external evidence to cite. The evidence is the interaction pattern itself: physical board games are manipulated by picking up and placing pieces, not by a two-tap sequence. Validated by play-testing feel, not data.

## Proposed Solution

Make each placed pebble a draggable Phaser object. Pressing down on your own pebble (movement phase only) selects it exactly as tapping it does today — same ring, same legal-destination highlights, same `onVertexTap`-driven state machine. Moving the pointer drags the pebble visually to follow it. Releasing over a legal destination's drop zone executes the move (routes through the existing `onVertexTap`, so trap/draw/win detection is unchanged). Releasing anywhere else snaps the pebble back to its origin and deselects — mirroring "tap elsewhere deselects."

Chosen over rebuilding a parallel drag-specific rules path because the tap state machine (`BoardScene.onVertexTap`) is already fully specified and tested (phase 4 + the draw-rule work) — drag becomes a second **input method** feeding the same decisions, not a second **decision system**.

## Key Hypothesis

We believe adding drag as an alternate move input will make the game feel like manipulating a physical board piece, without changing what a legal move is.
We'll know we're right when a full game can be played start-to-finish using ONLY drag gestures (placement stays tap — see scope) and produces identical, correct outcomes to the existing tap path, with zero regressions in tap-to-move.

## What We're NOT Building

- Drag-to-place during the placement phase — there's no pebble on the board yet to drag; placement stays tap-only.
- Removing tap-to-move — both coexist (user decision).
- A "can't drop here" live visual cue while hovering an illegal zone mid-drag — nice-to-have, deferred (Could).
- Haptic-style pebble scale/lift effect while dragging — deferred (Could).
- Multi-touch / simultaneous drags — irrelevant, hotseat has one active player at a time.
- Any engine (`engine/`) change — this is 100% input-layer; `applyMove`/`legalMoves` are untouched and already fully tested.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Drag executes legal moves | drag-release on a legal destination moves the pebble, matches tap-move outcome | in-browser scripted drag |
| Illegal drop is a no-op | release off any legal destination snaps back, no state change | in-browser scripted drag |
| Tap regression | existing tap-select-then-tap-destination flow still works identically | replay phase-4's browser validation script |
| Opponent pieces never draggable | only `state.current`'s own pebbles respond to drag | in-browser check both players' turns |
| No engine regression | 22/22 existing vitest tests unchanged | `vitest` |

## Open Questions

- [ ] Should a completed drag-move still play the ~200ms tween, or should the drag's own real-time following make the existing tween feel redundant/janky (a tiny "settle" tween into the exact vertex center is likely still desirable — default: keep it, it's cheap and already built).
- [ ] Desktop mouse vs touch: identical code path expected (Phaser unifies pointer input — confirmed in phase 4's investigation), but worth a real touch-device check post-implementation, not just DevTools emulation.

---

## Users & Context

**Primary User**
- **Who**: Reza + one other person, hotseat on one phone or desktop browser (unchanged from the base game).
- **Current behavior**: taps their pebble, taps the destination.
- **Trigger**: any movement-phase turn.
- **Success state**: press-drag-release feels like sliding a physical piece; tap still works if that's easier in the moment (e.g. across a wider board later).

**Job to Be Done**
When it's my turn to move, I want to grab my pebble and drag it to where I want, so it feels like moving a real board piece instead of two separate taps.

**Non-Users**
N/A — personal project, no external audience.

---

## Solution Detail

### Rules (NORMATIVE — implement exactly)

> **Every rule below was traced against Phaser 4.0.0's ACTUAL source** (`node_modules/phaser/src/input/InputPlugin.js`), not docs, not assumption — a first draft of this section was adversarially reviewed and TWO of its core claims were proven backwards against the real event semantics (see Decisions Log / Research Summary). Do not "simplify" the exact event wiring below back toward the more "obvious" design — the obvious design is the one that was refuted.

#### The two load-bearing facts that shape everything below
1. **`dragstart` fires BEFORE `pointerdown`, and `dragend` fires on EVERY press/release pair — including a zero-movement tap** — with `dragDistanceThreshold`/`dragTimeThreshold` at their default of 0. `dragend`'s `dropped` parameter is `false` on a plain tap (no drop zone was ever hit, since no movement means `processDragMoveEvent` never ran). This means `dragend` CANNOT be used as "the drag failed, clean up" without also distinguishing it from an ordinary tap — a `didDrag` flag (set only inside the `drag` event, which fires ONLY after real movement) is required for that distinction.
2. **`setInteractive({ dropZone: true })` on an object that is ALREADY interactive is a silent no-op** — Phaser's `enable()` takes an early-return branch for already-interactive objects and never applies the dropZone flag from that config form. The only reliable way to turn an existing interactive object into a drop zone is `existingObject.input.dropZone = true` (a direct property set, done AFTER its normal `setInteractive(...)` call). This does NOT disable its existing tap behavior — `pointerdown` still fires on it normally; being a drop zone is additive.

#### Scope of draggability
A pebble is draggable **if and only if**: `phase === 'movement'` AND the pebble belongs to `state.current` (the player whose turn it is). Opponent pebbles and any pebble during `placement`/`gameover` are never draggable.

Draggability is a **full sweep, every state change** — not "enable the mover's pebbles" (which leaves the PREVIOUS player's pebbles still draggable). A single `refreshDraggable()` step must run after every state reassignment (end of `applyAndSync`, after `restartGame` resets state) and iterate ALL pebbles in `pebbleObjects`, setting each one's draggable flag via `this.input.setDraggable(pebble, phase==='movement' && board[thatPebblesVertex]===current)`. `setDraggable(obj, false)` is how an already-draggable object gets disabled — this is a toggle, not a one-time setup call.

Pebbles must be made interactive (`setInteractive(...)`) **once, at creation** (in `syncPebbles`'s placement branch — that branch currently creates pebbles with NO interactivity at all; this PRD adds it there), independent of whether they start out draggable. `setDraggable` requires an object to already be interactive or it throws — interactivity is permanent per-pebble, draggability toggles.

#### Pebbles must resolve their OWN CURRENT vertex dynamically, never a creation-time closure
The existing hit-circle pattern captures its vertex id in a closure at creation (`hit.on('pointerdown', () => this.onVertexTap(v.id))`) — correct there because hit-circles never move. Pebbles DO move (re-keyed in `pebbleObjects` on every successful move), so a closure-captured id goes stale after a pebble's first move. Instead: every pebble carries `.setData('vertexId', <id>)`, and `syncPebbles` MUST update this data tag both when a pebble is created (placement) AND every time it's relocated (movement) — not just at creation. Event handlers read the CURRENT id via `pebble.getData('vertexId')` at the moment they fire, never a captured variable.

#### Drop-zone reuse (not duplication)
The existing per-vertex invisible hit-area circles keep their exact existing `setInteractive(new Geom.Circle(tapRadius, tapRadius, tapRadius), Geom.Circle.Contains)` call UNCHANGED, then additionally get `hit.input.dropZone = true` (the direct-property form — see load-bearing fact #2 above) and `hit.setData('vertexId', v.id)`. Do NOT create new geometry or a separate "snap radius" concept; `tapRadius` is the drop tolerance too. This does not change how the hit-circles respond to ordinary taps (placement, tap-to-move-destination) — those continue to work exactly as before; dropZone status is purely additive.

#### Pebble interactive hit area
Pebbles get their OWN interactive hit area sized to the pebble itself, using the SAME verified local-space pattern as the hit-circles: `new Geom.Circle(THEME.pebbleRadius, THEME.pebbleRadius, THEME.pebbleRadius)` — this is correct for a centered-origin Arc regardless of its actual radius value (verified: `displayOriginX/Y = radius` for any `this.add.circle(x,y,r)`, independent of fill alpha). `setInteractive(...)` MUST be called before `setDraggable(...)` on the same object (the latter throws if the object has no `.input` yet).

#### Event wiring (per pebble, wired once at creation)
```ts
let didDrag = false;

pebble.on('pointerdown', () => {
    didDrag = false;
    this.onVertexTap(pebble.getData('vertexId'));
});

pebble.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
    didDrag = true;
    pebble.x = dragX;
    pebble.y = dragY;
});

pebble.on('drop', (_pointer: Phaser.Input.Pointer, dropZone: Phaser.GameObjects.GameObject) => {
    const originVertexId = pebble.getData('vertexId');
    const targetVertexId = dropZone.getData('vertexId');
    this.onVertexTap(targetVertexId);
    //  onVertexTap only relocates the pebble in pebbleObjects on a LEGAL
    //  move; if it's still registered at its own origin, nothing moved
    //  (illegal target) — snap the VISUAL position back. syncPebbles'
    //  own tween already handles the legal-move case, so no `else`.
    if (this.pebbleObjects[originVertexId] === pebble) {
        this.snapPebbleToVertex(pebble, originVertexId);
    }
});

pebble.on('dragend', (_pointer: Phaser.Input.Pointer, _dragX: number, _dragY: number, dropped: boolean) => {
    //  Fires on EVERY press/release, including a plain tap (dropped=false
    //  there too) — didDrag distinguishes "real drag released off any
    //  zone" from "just a tap". A drop that landed on SOME zone is fully
    //  handled by the 'drop' listener above; don't double-handle it here.
    if (didDrag && !dropped) {
        this.snapPebbleToVertex(pebble, pebble.getData('vertexId'));
        this.clearSelection();
    }
});
```
`snapPebbleToVertex(pebble, vertexId)` is a small helper: tween `pebble.x/y` to `this.vertexPos[vertexId]`, duration `THEME.moveTweenMs`, same easing as the existing move-tween in `syncPebbles`.

#### Why this ordering is correct (all 6 cases traced)
- **Plain tap** (no movement): `pointerdown` selects (didDrag stays false); `dragend` fires per fact #1 but the `didDrag` guard skips it entirely. Selection persists. ✓
- **Reselect same/different own pebble**: unchanged, existing `onVertexTap` behavior, no drag involved. ✓
- **Drag → legal destination**: `pointerdown` selects → `drag` sets `didDrag=true` and follows the pointer → `drop` fires (a zone WAS hit), `onVertexTap` executes the move (which re-keys `pebbleObjects` and starts its own tween) → the `pebbleObjects[origin] === pebble` check is now false → no extra snap-back. `dragend` then fires with `dropped=true` → guard is false → no-op. ✓
- **Drag → illegal but zoned target** (opponent pebble / non-legal empty vertex): `drop` fires, `onVertexTap` deselects (no move), `pebbleObjects[origin] === pebble` is still true → snap back happens INSIDE the `drop` handler. `dragend` then fires with `dropped=true` → guard is false → no double snap-back. ✓
- **Drag → released off any zone** (e.g. off the board): `drop` never fires (no target was ever set — `processDragMoveEvent` only assigns a target when passing over a zone). `dragend` fires with `dropped=false`, `didDrag=true` → guard fires → snap back + `clearSelection()`. ✓

#### Legal-destination highlights during drag
Live from the moment of pickup (user decision) — comes free: `pointerdown` already calls `onVertexTap` → `selectVertex`, which is the exact same call a tap-select makes. No new highlight code needed.

#### Known accepted side-effect: `onVertexTap` fires twice per press on an occupied vertex
Pressing on a pebble triggers `pointerdown` on BOTH the pebble's own hit area and the vertex hit-circle beneath it (Phaser's down-event dispatch does not stop at the topmost object, unlike drag/move events). `onVertexTap(sameVertexId)` therefore runs twice per press. This is harmless TODAY because selecting an already-selected vertex is idempotent (`selectVertex` recomputes the same state). Treat this idempotency as an INVARIANT `onVertexTap` must keep — any future change to it must remain safe to call twice in a row with the same vertex.

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Pebbles draggable only when own + movement phase | correctness, matches existing tap-select rule |
| Must | Drag routes through `onVertexTap` (no parallel logic) | zero divergence risk from the tested tap path |
| Must | Pebble follows pointer during drag | user decision |
| Must | Illegal drop snaps back, no state change | user decision |
| Must | Live legal-destination highlights during drag | user decision — comes free from reusing `onVertexTap` |
| Must | Tap-to-move keeps working unchanged | "coexist" — the core scope decision |
| Should | Snap-back uses the existing move-tween duration for consistency | polish, cheap |
| Could | Live invalid-drop visual cue while hovering an illegal zone | deferred |
| Could | Pebble lift/scale effect while dragging | deferred |
| Won't | Drag-to-place, multi-touch, engine changes | out of scope |

### MVP Scope
Everything in Must above. This is the whole feature — there's no smaller slice that validates the hypothesis (a partial drag that doesn't snap back correctly, or doesn't gate by ownership, isn't shippable).

### User Flow
Movement phase, your turn → press down on your own pebble → it lifts (selected: ring + legal-destination highlights appear) → drag → pebble follows your finger/cursor → release:
- over a legal destination → pebble settles there (tween), turn advances, trap/draw/win checked exactly as today.
- anywhere else → pebble tweens back to where it started, selection clears.

Tap-select-then-tap-destination continues to work exactly as before, untouched, at any point in the same game.

---

## Technical Approach

**Feasibility**: HIGH — but only after two CRITICAL corrections found by reading Phaser 4.0.0's actual shipped source (`node_modules/phaser/src/input/InputPlugin.js`), not docs. A first draft of this PRD assumed the "obvious" API shape and got both wrong; see Research Summary for the citations. The corrected facts:
- `gameObject.setInteractive()` + `this.input.setDraggable(gameObject)` enables dragging; events are `dragstart`, `drag`, `dragend` on the object — BUT `dragstart` fires BEFORE `pointerdown` on press, and `dragend` fires on every press/release pair including a zero-movement tap (with `dropped:false`). A `didDrag` flag (set only inside `drag`, which fires only after real movement) is required to tell a real cancelled drag apart from a plain tap — see the normative event wiring in Solution Detail.
- `drag` event's `dragX`/`dragY` ARE world-space (confirmed correct for these scene-root, non-Container pebbles) — directly assignable to `gameObject.x`/`gameObject.y`. This part of the original research survived review unchanged.
- Drop zones: `hitCircle.setInteractive({ dropZone: true })` is a **silent no-op** on an object that's already interactive (which every hit-circle is) — Phaser's `enable()` short-circuits and never applies that config form's dropZone flag. The correct form is `hitCircle.input.dropZone = true`, a direct property set AFTER the existing `setInteractive(...)` call. The `drop` event fires on the dragged object (the pebble): `pebble.on('drop', (pointer, dropZoneGameObject) => ...)`.

**Architecture Notes**
- `BoardScene` is the only file that changes. `engine/` is completely untouched — this feature is pure input-layer, reusing `onVertexTap` end to end. This mirrors the draw-rule PRD's proof that engine and rendering are properly decoupled, just from the opposite direction (an input change touching zero engine code, instead of an engine change touching zero rendering code).
- `refreshDraggable()` is a full sweep over every pebble on every state change (end of `applyAndSync`, after `restartGame`) — NOT "enable the mover's pebbles," which would leave the previous player's pebbles still draggable. `setDraggable(pebble, boolean)` is the toggle.
- Pebbles need `.setData('vertexId', ...)` kept in sync on EVERY relocation (placement AND movement) inside `syncPebbles` — never a creation-time closure capture (that pattern is correct for the hit-circles, which never move, and wrong for pebbles, which do).
- The snap-back reconciliation is split across `drop` (illegal-but-zoned target) and `dragend` (released off any zone) — see the fully-traced 6-case table in Solution Detail for why both call sites are needed and why they don't double-fire.

**Files (expected)**
- `src/game/scenes/BoardScene.ts` — pebble interactivity/draggability (added in `syncPebbles`'s placement branch), `.setData('vertexId', ...)` kept current on every relocation, `hit.input.dropZone = true` on the existing hit-circles, drag event wiring, `refreshDraggable()`, `snapPebbleToVertex()` helper.
- No other files expected. No engine, no HUD, no CSS changes.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Implementer reverts to the "obvious" `dropZone:true`-in-config or dragend-always-clears design | M | both wrong forms are named explicitly above as things NOT to do, with the working replacement given verbatim |
| Pebble's own interactive region shadows the vertex hit-circle beneath it for taps | L | verified NOT a real risk — Phaser's down-event dispatch does not stop at topmost, both fire; documented as an accepted idempotent side-effect, not a bug |
| Stale `vertexId` after a pebble moves (closure-capture mistake) | M | explicit requirement to re-`setData` on every relocation, not just creation |
| Snap-back forgotten in one of the two required call sites (`drop` vs `dragend`) → pebble visually stuck | M | both call sites specified with the exact condition each checks; browser validation must include a deliberate illegal-drop AND a deliberate off-board-release check (two distinct code paths) |
| Draggable flag not refreshed on turn change → wrong player can drag | M | explicit full-sweep `refreshDraggable()` requirement tied to every state change |
| Regression in existing tap flow | L | zero new decision logic — drag is purely an alternate way to call the same function; full phase-4 tap regression script re-run as part of validation |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Drag-to-move | pebble draggability, drop zones, drag event wiring, snap-back reconciliation, full browser validation (drag + tap regression) | complete | - | - | `.claude/PRPs/plans/completed/drag-to-move.plan.md` — report: `.claude/PRPs/reports/drag-to-move-report.md` |

### Phase Details

**Phase 1: Drag-to-move**
- **Goal**: drag works end-to-end for legal and illegal drops, tap-to-move is unaffected.
- **Scope**: `BoardScene.ts` only — pebble hit areas + draggable, hit-circle drop zones, `dragstart`/`drag`/`drop`/`dragend` wiring into `onVertexTap`, snap-back tween, draggability refresh on state change.
- **Success signal**: in-browser, a full game playable using only drag; a deliberate illegal drop snaps back with no state change; the phase-4 tap regression script still passes unchanged; 22/22 engine tests unaffected (zero engine diff).

### Parallelism Notes
Single phase — the feature is one cohesive unit of work, no natural split.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Tap vs drag | both coexist | drag replaces tap | zero regression risk on the proven tap path (user chose) |
| Illegal drop | snap back, no move | nearest-legal-within-radius forgiveness | matches physical-piece intuition; simpler (user chose) |
| Highlights during drag | live, from drag start | none until drop | drag start = existing select, highlights are free (user chose) |
| Visual drag behavior | pebble follows pointer | pebble stays put until drop | standard drag-and-drop expectation (user chose) |
| Decision logic ownership | drag routes through existing `onVertexTap` | drag implements its own legality checks | avoids a second, divergence-prone rules path; engine/interaction PRDs already fully specified this state machine |
| Drop-zone geometry | reuse existing per-vertex hit-circles | new dedicated drop-zone objects | avoids duplicate geometry/radius concepts; `tapRadius` already correctly proven and sized |
| Drop-zone flag mechanism | `hitCircle.input.dropZone = true` (direct property) | `setInteractive({ dropZone: true })` | the config form is a silent no-op on an already-interactive object — proven by reading Phaser's `enable()` source, not assumed |
| Tap/drag disambiguation | `didDrag` flag set only inside the `drag` event | rely on `dragend`'s `dropped` param alone | `dropped` is false for BOTH a plain tap and a real off-board release — they're indistinguishable without tracking whether real movement occurred |
| Pebble vertex identity | `.setData('vertexId', ...)` updated on every relocation | closure-captured id at creation (mirroring the hit-circle pattern) | hit-circles never move (closure is safe); pebbles do move (closure goes stale after first move) — different situations, can't reuse the same pattern blindly |

---

## Research Summary

**Market Context**
Drag-to-move is the standard interaction for digital board/abstract-strategy games (chess apps, mancala, etc.) — tap-based move confirmation exists but drag is generally considered the more "physical" feeling default. No competitor research needed beyond this; this is a personal-project polish feature, not a market bet.

**Technical Context**
This PRD went through one full draft/adversarial-review cycle. The FIRST draft's technical claims were sourced from Phaser's public docs/WebSearch (the same approach that worked for the interaction-flow and draw-rule PRDs) and stated event ordering and drop-zone setup that turned out to be wrong for this project's exact behavior. An Opus reviewer re-derived every claim by reading `node_modules/phaser/src/input/InputPlugin.js` directly (the actual shipped Phaser 4.0.0 build, not the docs site) and found:
- **Confirmed correct**: `dragX`/`dragY` are world-space and directly assignable for scene-root (non-Container) objects (`InputPlugin.js:1207–1213, 1416–1422`); the local-space `Geom.Circle(radius, radius, radius)` hit-area pattern is correct for any Arc regardless of its radius or fill alpha (`Arc.js:113–114`, `Origin.js`).
- **Wrong — event ordering**: `dragstart` fires before `pointerdown` on press, and `dragend` fires unconditionally on every release including zero-movement taps (`InputPlugin.js:749–769, 1202, 1215, 1282–1287, 1480, 1506–1511`) — the opposite of the first draft's assumption that `pointerdown` could be wired independently of drag concerns.
- **Wrong — drop-zone activation**: `setInteractive({ dropZone: true })` on an already-interactive object never sets `input.dropZone` because `enable()` short-circuits before reaching the code path that reads that flag (`InputPlugin.js:934–945`); confirmed the working form is the direct property set (`:984` reads `input.dropZone` directly).
- **Found, not previously specified**: `dragend`'s 4th parameter `dropped: boolean` (`GAMEOBJECT_DRAG_END_EVENT.js:25`) should be used directly rather than hand-tracking "did a drop occur."
- **Found, a genuine latent bug**: pebbles are re-keyed across vertices as they move; a closure-captured vertex id (mirroring the hit-circle pattern, which is safe only because hit-circles never move) would silently route input to a stale vertex after a pebble's first move.

Existing codebase facts relied on, reconfirmed: `BoardScene.onVertexTap` (interaction-flow PRD) is the single source of move/select/deselect decisions; `syncPebbles`'s move-tween already targets absolute destination coordinates, so it "just works" for a completed drag-move without modification; pebbles are CURRENTLY created with zero interactivity in `syncPebbles`'s placement branch (this PRD is the first to add any).

---

*Generated: 2026-07-15*
*Status: REVIEWED — adversarially refuted by an Opus agent 2026-07-15, reading Phaser 4.0.0's actual source rather than docs. 2 CRITICAL findings applied (dragstart/pointerdown/dragend ordering was backwards; `setInteractive({dropZone:true})` on an already-interactive object is a silent no-op) + 1 HIGH (stale vertex-id after a pebble moves) + 1 MEDIUM (missing documented `dropped` param) + 1 LOW (harmless double-fire on occupied-vertex press, now documented as an accepted invariant). Survived: world-space `dragX`/`dragY`; local-space pebble hit-area math. Foundation questions answered as inferred assumptions for this solo project. Relates to completed pebble-trap.prd.md and draw-by-repetition.prd.md.*
