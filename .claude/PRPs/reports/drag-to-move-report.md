# Implementation Report: Drag-to-Move Pebbles (Pebble Trap)

## Summary
Pebbles are now draggable during the movement phase, wired as a second input method into the exact same `onVertexTap` state machine tap-to-move already used. Press-drag-release now works end-to-end: press selects (ring + legal-destination highlights, same as a tap), drag follows the pointer live, release on a legal destination executes the move (same trap/draw/win detection as tap), release anywhere else snaps back and deselects. Tap-to-move is completely unaffected — both input methods now permanently coexist. Verified live in the browser through Phaser's actual input system (synthetic `MouseEvent` sequences, not typecheck alone) across 9 scenarios including both of phase 4's original T4/T7 device-replay checks. `engine/`, `modes/`, `ui/`, and `public/` remain untouched — this was 100% input-layer, confirmed via `git diff --stat`.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium — matched |
| Confidence | 9/10 (held back only on browser-validation surface area) | held — implementation compiled clean on first pass for every task; the one held-back point (synthetic drag-gesture quirks) materialized, but as a **planning-script** issue, not a product bug (see Deviations) |
| Files Changed | 1 (update) | 1, exactly as planned — `+119/-0` lines (pure additions) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `createVertexHitAreas` — drop-zone flag + vertexId tag | done | exact plan snippet, `if (hit.input)` guard needed and included |
| 2 | `wirePebbleEvents` + `snapPebbleToVertex` methods | done | exact plan snippet |
| 3 | `syncPebbles` rewrite — interactivity, data tag, event wiring | done | exact plan snippet |
| 4 | `refreshDraggable` method | done | exact plan snippet |
| 5 | Wire `refreshDraggable()` into `applyAndSync` + `restartGame` | done | exact plan snippet |
| 6 | Validation sweep (static + regression + browser) | done | see Validation Results — 9 browser scenarios, one adapted mid-run (see Deviations) |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | Pass | `tsc --noEmit` zero errors — but see Deviations for a plan-documentation correction found along the way |
| Unit Tests | Pass | 22/22 unchanged — engine untouched (`git diff --stat -- src/game/engine` empty) |
| Build | Pass | `vite build` clean |
| Engine/Mode/UI-frozen check | Pass | `git diff --stat -- src/game/engine src/game/modes src/ui public` empty |
| Browser — placement (tap) | Pass | N,S,C,W taps → board matches `{N:1,S:2,C:1,W:2,E:null}`, HUD "Red: move a pebble" |
| Browser — drag → legal destination | Pass | C→E drag: pebble slides, turn advances to Blue, console clean |
| Browser — drag → illegal-but-zoned target | Pass (adapted target) | see Deviations — landed on the "reselect via drop onto own occupied piece" sub-case instead of the originally-scripted one; still fully exercises the `drop`-handler snap-back path and additionally reconfirms drag-driven reselection |
| Browser — drag → released off every zone | Pass | pebble snaps back, selection clears, no state change |
| Browser — opponent pebble never draggable | Pass | Blue's pebble does not move at all during a drag gesture on Red's turn; press still correctly deselects |
| Browser — tap regression after drag exercises | Pass | tap-select + tap-move-to-legal-destination completes normally, turn advances, no leaked `didDrag`/selection state |
| Browser — T7 placement-trap replay | Pass | S,C,W,N taps → "Blue wins!" fires immediately on the 4th placement, no movement phase — matches phase 4's exact fixture |
| Browser — T4 movement-trap replay | Pass, via drag | E,S,N,W placed (tap) → E→C executed via **drag** (not tap) → "Red wins!" fires correctly — this simultaneously validates the plan's step 9 ("drag into a trap shows the correct HUD overlay") since the trapping move itself was a drag |
| Browser — restart ×2 | Pass | verified twice in a row, no leftover pebble objects or highlight ring |
| Browser — narrow viewport (390×844) | Pass | HUD turn text and Menu button both visible, no overlap, canvas correctly pillar-boxed |
| Console | Pass | zero errors/warnings across every scripted interaction, both tabs |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `src/game/scenes/BoardScene.ts` | UPDATED | +119 / -0 |

## Deviations from Plan

**1. Plan's `noUnusedLocals` claim was wrong (caught immediately by the first per-task typecheck).** The plan's Task 2 VALIDATE note claimed "unused-method warnings are not a `tsc --noEmit` failure ... `noUnusedLocals`/`noUnusedParameters` ... don't apply to class methods." This is incorrect — TypeScript's `noUnusedLocals` does flag unused private class members. After Task 2 (adding `wirePebbleEvents`) and again after Task 4 (adding `refreshDraggable`), `tsc --noEmit` correctly failed with `TS6133: '...' is declared but its value is never read`, since each method's call site was added in the *next* task. This is an inherent, harmless consequence of the plan's own task ordering (define-then-wire), not a code defect — resolved by proceeding immediately to the next task each time, exactly as the plan's tasks were already sequenced to do. No code changed as a result; this is purely a correction to the plan's own validation commentary for future reference.

**2. Task 6's scripted "illegal-but-zoned" drag target didn't match the live board state (self-diagnosed and adapted, not a product bug).** The plan's step 4 assumed C would still be Red-occupied at that point in the script. But step 3 (drag C→E) had already vacated C, so the plan's own step 4 (drag Blue's W pebble to C) was actually testing a **legal** move by the time it ran — and the product code correctly executed it as one (turn advanced to Red). This is a sequencing mistake in the plan's own validation script — each step's board-state assumption should have been re-derived from the *actual* previous step's outcome rather than from the original static mock-up. Diagnosed immediately (console stayed clean; the resulting board state was internally consistent, just not the one predicted) and adapted on the fly: retargeted the "illegal-but-zoned" check to drag Red's E pebble onto Red's own occupied N vertex instead. This exercises the same `drop`-handler snap-back code path the step was designed to validate, and additionally reconfirms that dragging onto your own occupied piece correctly re-selects it (an existing `onVertexTap` behavior, now proven to also work when triggered via the `drop` event rather than a tap). No product code changed. Later steps (opponent-draggability, tap regression, T7, T4) were all re-derived against the actual live board state at each point rather than re-consulting the original static script, and all passed.

**3. Validation script timing — synchronous DOM reads outrun Phaser/React (self-diagnosed, test-harness-only, matches the class of issue phase 4 already documented).** The very first attempt combined firing 4 synthetic taps AND reading `document.querySelector('.hud-turn').textContent` in one synchronous `evaluate_script` call. The read captured pre-interaction DOM state — Phaser processes queued native input events on its own `requestAnimationFrame`-driven loop, not synchronously inside the dispatching script, so no frame had actually run yet. A screenshot taken moments later (a separate tool round-trip) showed the board was in fact already fully and correctly updated. Fixed by always reading results (screenshot/console) in a separate tool call after firing input, from that point on — every subsequent step used this pattern and all reads were accurate. This is a test-harness characteristic, not a bug in `BoardScene.ts` or in the plan's own drag-simulation technique (which — separately — the plan had already proactively hardened with the `event.buttons: 1` requirement on synthetic `mousemove`, and that specific mitigation worked correctly with zero issues throughout).

None of the three deviations above required any change to the shipped code in `BoardScene.ts` — the implementation matches the plan's Step-by-Step Tasks exactly, verbatim.

## Issues Encountered
See Deviations — all three were self-diagnosed and resolved within this implementation pass, none required product-code changes.

## Tests Written
None — per the plan's Testing Strategy, this phase is pure input/rendering wiring over an already-tested, untouched engine (22 tests from prior phases remain the regression gate, confirmed still 22/22 green with an empty `engine/` diff). The 9-scenario browser script was the functional test.

## Project Status
**Drag-to-move PRD complete — its only phase.** The well game is now fully playable via drag alone (placement stays tap-only, per explicit scope) with zero regression to the existing tap-select-then-tap-destination flow. Combined with the prior draw-by-repetition work, the game now supports: placement, movement via tap OR drag, trap detection, threefold-repetition draw detection, and correct HUD display for wins/draws — all reachable through either input method interchangeably, mid-game.

## Next Steps
- [ ] Commit: `feat: add drag-to-move for pebbles` (no co-author trailer, per standing preference)
- [ ] Push to `main`
- [ ] Optional: real touch-device check (PRD's second Open Question — desktop mouse vs. touch is expected to be identical via Phaser's unified pointer input, per phase 4's prior investigation, but not yet confirmed on an actual touchscreen)

---
*Generated: 2026-07-15*
