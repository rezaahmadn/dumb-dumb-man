# Implementation Report: Draw by Threefold Repetition — Phase 1 (Engine Draw Detection)

## Summary
Threefold-position-repetition draw detection added to the engine. `GameState.history` records every movement-phase position (board layout + side-to-move); `EngineConfig.repetitionLimit` (well = 3) gates an auto-draw when a position's count reaches the limit. Pure engine change — `BoardScene` and all rendering code are untouched, confirmed by an empty `git diff` on `scenes/`/`ui/`. First-run green: all 22 tests passed with zero fix iterations, including the hand-traced 6-ply repetition cycle.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Small | Small — matched exactly |
| Files Changed | 4 (all UPDATE) | 4, exactly as planned |
| Confidence | high (moves verified twice pre-implementation) | held — 22/22 on first run, no debugging needed |

## Tasks Completed

| # | Task | Status |
|---|---|---|
| 1 | `types.ts` — optional `history`/`repetitionLimit` fields | done |
| 2 | `rules.ts` — `positionKey` + history recording + draw check in `applyMove` | done |
| 2b | `rules.ts` — `initialState` seeds `history: {}` | done |
| 3 | `modes/well/index.ts` — `repetitionLimit: 3` | done |
| 4 | `rules.test.ts` — `makeState`/`keyOf` helpers + T8–T12 | done |
| 5 | Validation sweep | done |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | Pass | `tsc --noEmit` zero errors |
| Unit Tests | Pass | **22/22 on first run** (17 existing unchanged + 5 new) |
| Build | Pass | vite prod build clean |
| Engine purity | Pass | grep for phaser imports under `engine/` empty |
| Scope confinement | Pass | `git diff --stat -- src/game/scenes src/ui` empty — proves the multi-mode architecture claim: a rule change touches only the engine |

## Files Changed

| File | Action | Diff |
|---|---|---|
| `src/game/engine/types.ts` | UPDATED | +2 (both new fields optional) |
| `src/game/engine/rules.ts` | UPDATED | +39/-7 (`positionKey` helper, `initialState` +1 line, `applyMove` draw-check tail) |
| `src/game/modes/well/index.ts` | UPDATED | +1 (`repetitionLimit: 3`) |
| `src/game/engine/__tests__/rules.test.ts` | UPDATED | +103 (`history` default, `keyOf` helper, T8–T12: 5 describe blocks) |

## Deviations from Plan
None — implemented exactly as planned. The plan's hand-traced 6-ply cycle (verified twice pre-implementation: adversarial exhaustive graph search + independent manual re-derivation during planning) reproduced correctly on the first test run with no debugging required — the pre-implementation verification effort paid off directly.

## Issues Encountered
None.

## Tests Written

| Test | Coverage |
|---|---|
| T8 | 6-ply cycle x2 → draw fires exactly on the 3rd occurrence (`gameover`, `winner:null`) |
| T9 | win/draw disjointness — trapping move wins regardless of unrelated history entries |
| T10 | 3 distinct movement positions never falsely draw |
| T11 | `repetitionLimit: undefined` disables detection even across 3 full cycle repeats (18 plies) |
| T12 | `applyMove` does not mutate input `history` |

## Next Steps
- [ ] Phase 2 — HUD draw display (`Hud.tsx` phase-guarded draw branch, browser validation of a scripted draw). Depends on this phase (complete).
- [ ] Commit: `feat: add threefold-repetition draw detection`

---
*Generated: 2026-07-15*
