# Implementation Report: Draw by Threefold Repetition — Phase 2 (HUD Draw Display)

## Summary
Fixed the exact bug the PRD flagged in advance: `Hud.tsx`'s gameover check was `isOver && game.winner !== null`, which rendered NOTHING for a draw (`isOver:true, winner:null`) — no turn line, no overlay, a blank soft-locked screen. Refactored to a single `isOver` gate with an internal win/draw branch, so exactly one overlay always renders on gameover. Verified live in the browser with the full 12-ply repetition sequence through Phaser's actual input — this is the first time a draw was exercised through the real UI (phase 1 only proved it at the engine level).

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Small | Small — matched exactly |
| Files Changed | 1 (UPDATE) | 1, exactly as planned |
| Confidence | high (fix fully specified in PRD) | held — typecheck/test/build clean on first pass; one browser-script mistake (not a product bug) caught and corrected mid-validation |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | `Hud.tsx` — single-overlay gameover branch | done | exact PRD-specified refactor |
| 2 | Validation sweep + browser proof | done | including full live repetition sequence |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | Pass | `tsc --noEmit` zero errors |
| Unit Tests | Pass | 22/22 unchanged — engine untouched this phase (`git diff --stat -- src/game/engine` empty) |
| Build | Pass | vite prod build clean |
| Browser — placement to T8 start | Pass | taps N,S,E,W → board matches `{N:1,S:2,E:1,W:2,C:null}`, HUD "Red: move a pebble" |
| Browser — 1st cycle (2nd occurrence) | Pass | still `movement`, no premature draw |
| Browser — 2nd cycle (3rd occurrence) | Pass | **"Draw!" overlay appears** — neutral cream text, [Play again][Menu], zero console errors |
| Browser — restart from draw | Pass | board clears, returns to placement, HUD normal |
| Browser — Menu availability from draw | Pass | Menu button present and functional on the draw overlay (same code path as win) |

## Files Changed

| File | Action | Diff |
|---|---|---|
| `src/ui/Hud.tsx` | UPDATED | conditional restructure: `isOver && winner!==null` → `isOver && (winner!==null ? win : draw)` |

## Deviations from Plan
None in the shipped code — implemented exactly as planned. One self-caught process note: my first browser validation attempt used a wrong tap sequence (encoded only 3 of the 6 required plies, looped incorrectly) and did not reach a draw. Diagnosed immediately as a validation-script bug (not a product bug — console stayed clean, engine handled the malformed sequence safely), corrected to the full 6-ply cycle matching the phase-1 unit test exactly, and the fix was then confirmed to work correctly on the first true attempt.

## Issues Encountered
See Deviations — self-corrected browser script error, no product-code impact.

## Tests Written
None — pure JSX/CSS branch fix already covered by phase 1's engine tests. The browser script in Task 2 was the functional test, and is the first end-to-end (tap-through-Phaser-to-React) proof of the draw feature.

## Project Status
**Draw-by-repetition PRD complete — both phases.** The well game now: places pebbles, moves them, detects traps, detects threefold-repetition draws, and displays all three outcomes correctly in the HUD with working restart/menu navigation.

## Next Steps
- [ ] Commit: `fix: display draw outcome in the HUD`
- [ ] Push to `main`

---
*Generated: 2026-07-15*
