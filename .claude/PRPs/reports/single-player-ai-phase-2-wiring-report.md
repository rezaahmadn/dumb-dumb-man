# Implementation Report: Single-Player AI — Phase 2 (Mode-Select + Wiring)

## Summary
Wired Phase 1's `chooseMove` solver into the real game. Added a new Solo/Hotseat select screen (`OpponentSelect.tsx`), relayed `opponentType` from React through Phaser's registry into `BoardScene` (matching the existing `modeId` relay pattern exactly), added AI-turn detection + a delayed `applyAndSync(chooseMove(...))` call reusing the human tap-path, blocked input while it's the AI's turn (both tap and drag), and added a "thinking..." HUD indicator. Zero engine changes.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium — matched |
| Confidence | 9/10 | Implemented single-pass, zero deviations |
| Files Changed | 8 (1 new, 7 updated) | 8 (1 new, 7 updated) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `aiMoveDelayMs` theme constant | Complete | |
| 2 | `BoardScene` turn-gating + AI move scheduling | Complete | Temporary debug hook (`window.__scene`) added for manual browser verification, removed before finalizing — not part of the diff |
| 3 | `main.ts` + `Boot.ts` registry relay | Complete | |
| 4 | `PhaserGame.tsx` opponentType prop | Complete | |
| 5 | `OpponentSelect.tsx` new screen | Complete | |
| 6 | `App.tsx` three-step render gate | Complete | |
| 7 | `Hud.tsx` thinking indicator | Complete | |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | Pass | `npm run typecheck` — zero errors |
| Full Test Suite | Pass | 26/26 unchanged — zero files under `src/game/engine/` touched |
| Manual Browser Playtest | Pass | Verified via `npm run dev` + chrome-devtools MCP against the real running app (see below) |

### Manual playtest detail
Real browser session (Chrome via MCP), driven through the actual React/Phaser app on `localhost:8081`:
- MainMenu → "Well Board" → new OpponentSelect screen rendered correctly with "Solo (vs AI)" / "Hotseat (2 Players)".
- **Solo**: placement phase — AI (Blue) correctly auto-placed twice (2nd and 4th placements) via the self-chaining `maybeScheduleAiMove` → `applyAndSync` loop, with zero extra code needed, exactly as the plan's Task 2 GOTCHA predicted. Transitioned cleanly into movement phase.
- **Turn-gating (tap)**: confirmed empirically — tapping the AI's own pebble during its turn produced zero board change (board before/after the tap were byte-identical).
- **Turn-gating (drag)**: confirmed empirically — read `pebbleObjects[key].input.draggable` directly off the live Phaser objects during the AI's turn; all of the AI's own pebbles were `false`, versus the pre-existing ownership-only logic which would have made them `true`.
- **HUD "thinking" indicator + timing**: polled the HUD DOM text every 50ms across a full AI turn. Text was `"Blue is thinking..."` from t=50ms through t=350ms, then flipped to `"Red: move a pebble"` at exactly t=400ms — matching `aiMoveDelayMs: 400` precisely.
- **Hotseat regression check**: played all 4 placements as alternating human taps; `current` alternated 2→1→2→1 with no AI auto-move ever interleaved (`opponentType` confirmed `'human'`), and the HUD never showed "thinking" text even after a 600ms wait — confirms every new guard is fully inert in hotseat.
- Zero console errors across both modes for the full session.

Coordinate-based synthetic pointer-event dispatch into the Phaser canvas proved unreliable (Scale Manager transform internals not confidently reproducible from outside); testing instead called the real `onVertexTap`/`getSnapshot` methods directly on the live scene instance via a temporary `window.__scene` debug hook, added and removed within this session — exercises the identical code path a real tap/drag would trigger, with no source-level shortcuts taken.

## Files Changed

| File | Action | Lines |
|---|---|---|
| `src/ui/OpponentSelect.tsx` | CREATED | +20 |
| `src/game/render/theme.ts` | UPDATED | +2/-1 |
| `src/game/scenes/BoardScene.ts` | UPDATED | +32/-2 |
| `src/game/main.ts` | UPDATED | +2/-1 |
| `src/game/scenes/Boot.ts` | UPDATED | +2/-1 |
| `src/PhaserGame.tsx` | UPDATED | +3/-2 |
| `src/App.tsx` | UPDATED | +16/-2 |
| `src/ui/Hud.tsx` | UPDATED | +9/-3 |

## Deviations from Plan
None in the shipped diff. One process deviation: the plan's Testing Strategy correctly anticipated no automated UI tests, but didn't anticipate the difficulty of driving Phaser canvas input from an external browser-automation tool — resolved via a temporary debug hook (added and removed within this session, not shipped) rather than skipping manual verification.

## Issues Encountered
Synthetic `PointerEvent` dispatch on the Phaser canvas did not register with Phaser's Scale Manager / Input Manager coordinate transform from outside the page (root cause not fully diagnosed — likely a Phaser-internal detail of how it computes pointer position from `pageX`/`pageY` vs. canvas bounds). Resolved by calling the real scene's methods directly instead of simulating DOM events, which exercises the same application code without depending on the unresolved transform detail.

## Tests Written
None — see PRD/plan: this repo has zero React/Phaser UI test coverage by design (`vitest.config.ts` scopes to `src/game/engine/**/*.test.ts` only). Correctness of this phase was established via direct manual verification against the real running app instead (see above).

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Create PR via `/prp-pr`
- [ ] Both PRD phases now complete — no further phases planned
