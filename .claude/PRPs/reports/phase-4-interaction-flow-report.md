# Implementation Report: Phase 4 — Interaction & Flow (Pebble Trap)

## Summary
Full hotseat game loop implemented and verified with real simulated taps through Phaser's actual input system (not just typecheck/build): tap-to-place, tap-to-select/move with legal-move highlights, ~200ms move tween, React HUD (turn indicator + win overlay) wired to the engine via `EventBus`, and restart. Both PRD-mandated device-replay checks (T4 movement-trap, T7 placement-trap) reproduced exactly as specified. Engine (`engine/`, `modes/well/`, `registry.ts`) remains untouched — frozen invariant held via `git diff` check both before and after debugging.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium — matched, but required live debugging beyond the plan's anticipated gotchas |
| Confidence | plan verified 2 Phaser input API gotchas via docs before writing code | held for game logic; ONE additional runtime bug slipped through doc verification (see Deviations) |
| Files Changed | 5 (1 create, 4 update) | 5, exactly as planned |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | theme.ts additions | done | |
| 2 | BoardScene.ts rewrite | done | 1 runtime bug found + fixed during browser validation (see below) |
| 3 | ui/Hud.tsx | done | |
| 4 | style.css HUD rules | done | |
| 5 | App.tsx rewrite | done | |
| 6 | Validation sweep | done | typecheck/test/build clean; full scripted browser playthrough incl. T4 and T7 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | Pass | `tsc --noEmit` zero errors |
| Unit Tests | Pass | 17/17 unchanged — engine untouched |
| Build | Pass | vite prod build clean |
| Engine-frozen check | Pass | `git diff --stat` on `engine/`, `modes/well/`, `registry.ts` empty |
| Browser — placement | Pass | tap-to-place, occupied-vertex no-op, turn alternation, correct pebble colors/positions |
| Browser — T4 (movement trap) | Pass | exact PRD sequence (place E,S,N,W; select E; move E→C) → "Red wins!", tween visible, zero console errors |
| Browser — T7 (placement trap) | Pass | exact PRD sequence (place S,C,W,N) → gameover on the 4th placement itself, no intermediate movement phase — the specific soft-lock the PRD warned about |
| Browser — gameover input lock | Pass | taps after gameover are no-ops |
| Browser — restart | Pass | verified twice in a row, no leftover pebble objects or highlight ring |
| Browser — selection UX | Pass | select → ring + legal-dest highlight; tap different own pebble → reselects; tap opponent pebble → deselects |
| Browser — narrow viewport (390×844) | Pass | HUD text stays aligned with canvas pillar |
| Console | Pass | zero errors/warnings across the entire scripted playthrough (after the fix below) |

## Files Changed

| File | Action |
|---|---|
| `src/game/render/theme.ts` | UPDATED (+`highlightColor`, `PLAYER_NAME`, `PLAYER_COLOR_CSS`) |
| `src/game/scenes/BoardScene.ts` | UPDATED (owns GameState, input handling, pebble sync+tween, highlights, `getSnapshot`/`restartGame`) |
| `src/ui/Hud.tsx` | CREATED (new `ui/` folder — turn indicator + win overlay) |
| `public/style.css` | UPDATED (+HUD layer/box/turn/overlay/button rules) |
| `src/App.tsx` | UPDATED (scene-ref plumbing, snapshot state, EventBus subscription) |

## Deviations from Plan

**Runtime bug found during browser validation, not caught by the plan's pre-verified API research**: the plan's hit-area code used `new Phaser.Geom.Circle(...)` and `Phaser.Geom.Circle.Contains` — both are runtime references to the global `Phaser` namespace, which does not exist in this ESM build (confirmed bug pattern from phase 1's `Phaser.Scale.FIT` incident and phase 3's radians footgun — the SAME class of mistake, reintroduced despite the plan explicitly warning against it elsewhere in the same file). First browser load threw `Uncaught ReferenceError: Phaser is not defined`.

**Fix**: import `Geom` from `'phaser'` explicitly; use `Geom.Circle` / `Geom.Circle.Contains`. One import line + two call-site edits in `BoardScene.ts`. The three remaining `Phaser.X` references in phase-4 files (`Phaser.GameObjects.Arc`, `Phaser.GameObjects.Graphics`, `Phaser.Scene` — all TYPE positions) are correctly unaffected and left as-is, consistent with the established safe pattern.

**Standing gotcha reinforced for phase 5**: grep for `Phaser\.` before considering any Phaser-touching file done; type positions are safe, ANY runtime value/constructor/static-property access through the bare `Phaser` identifier is not.

**Test-harness-only issue (not a code bug)**: synthetic `PointerEvent` dispatch via CDP `evaluate_script` was not picked up by Phaser's registered input listener, even though the event demonstrably reached the canvas DOM element (confirmed via a temporary native listener) and the exact same coordinates worked when the underlying `onVertexTap` method was called directly. Native `MouseEvent('mousedown', ...)` dispatch DID work — Phaser's MouseManager binds to legacy mouse events, and its OWN internal `'pointerdown'` game-object event (which `hit.on('pointerdown', ...)` in the shipped code listens for) is Phaser's unified abstraction over mouse/touch/pointer input, not a passthrough of the native DOM `pointerdown` event type. This has no bearing on real users — real mouse clicks, touchscreen taps, and trackpad input all normalize into Phaser's `'pointerdown'` correctly; only synthetic `PointerEvent` construction for automated testing needed the `MouseEvent` substitution. A temporary debug hook (`window.__debugScene`, `debugTap()`) was added to isolate this, used to confirm game logic was correct independent of the DOM dispatch question, then fully removed before finalizing (grep-verified clean).

## Issues Encountered
Both issues above were resolved within this implementation pass; see Deviations for root cause and fix.

## Tests Written
None — this phase is UI/interaction wiring (per plan's Testing Strategy). The 17 engine tests from phase 2 served as the regression gate; the browser script (including the PRD-mandated T4/T7 device replays) was the functional test.

## Next Steps
- [ ] Phase 5 — Shell & polish (mode-select menu via `MODES` registry, "Menu" button on win overlay, asset manifest stub, theme pass). `App.tsx`'s scene-ref plumbing from this phase is reusable as-is.
- [ ] Commit recommended: `feat: wire tap interaction, HUD, and win flow`

---
*Generated: 2026-07-15*
