# Implementation Report: Pebble Clash — Phase 2: Engine Types + Pre-placed Init

## Summary

Widened the engine's type surface to admit jump-capture, elimination-win, pre-placed draughts modes. `Move` gained a `jump` variant; `EngineConfig` gained `movement: 'draughts'`, `win: 'elimination'`, `preplaced`, and `flyingThreshold`. `initialState` now seeds boards from `preplaced` config and opens in `movement` phase, while modes without `preplaced` behave identically to before. No game behaviour ships — all three changes are type/state foundation for Phase 3.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Small | Small ✓ |
| Confidence | 9/10 for single-pass | 10/10 — executed as planned, zero deviations |
| Files Changed | 4 (3 UPDATE, 1 CREATE) | 4 ✓ |
| Typecheck Flow | Breaking at Tasks 2–4, green after 4 | Exact as predicted ✓ |
| Tests | New C1–C3 vectors on fixture | 10 tests written ✓ |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Widen `EngineConfig` | ✓ Done | Added `movement: 'draughts'`, `win: 'elimination'`, `preplaced`, `flyingThreshold` |
| 2 | Add `jump` to `Move` | ✓ Done | `{ kind: 'jump'; from: VertexId; hops: { over: VertexId; to: VertexId }[] }` |
| 3 | Fix `applyMove` legality ternary | ✓ Done | Added `lm.kind === 'move' ?` test, `: false` fallback for `jump` |
| 4 | Guard `syncPebbles` | ✓ Done | `if (move.kind === 'jump') return;` — single line, exact placement |
| 5 | Teach `initialState` seeding | ✓ Done | Full conditional path: seed `preplaced`, validate, set `placed`, open in `movement` |
| 6 | Draughts throw guard | ✓ Done | `if (cfg.movement === 'draughts') throw` before skip check, prevents silent slide fallback |
| 7 | Write test vectors C1–C3 | ✓ Done | Synthetic 3-vertex fixture, 10 assertions covering seed/validation/regression |

## Validation Results

| Level | Status | Details |
|---|---|---|
| Type Check | ✓ Pass | Zero errors. Mid-implementation: 4 errors after Task 2, gone after Tasks 3–4 as predicted. Final: clean. |
| Unit Tests | ✓ Pass | 49 tests total: 39 pre-existing green, 10 new clash vectors (C1: 4, C2: 3, C3: 3) |
| Build | ✓ Pass | npm run typecheck: zero errors. |
| Integration | N/A | Not applicable — no mode registered, no scene behaviour |
| Edge Cases | ✓ Pass | Unknown preplaced ids throw; duplicate ids throw; `well`/`morris` unchanged; `draughts` throws on legalMoves |

## Files Changed

| File | Action | Lines | Change |
|---|---|---|---|
| `src/game/engine/types.ts` | UPDATE | +11 (EngineConfig), +5 (Move comment + variant) | Widened both interfaces |
| `src/game/engine/rules.ts` | UPDATE | +8 (draughts guard), +23 (initialState) | Seeding + validation + throw on draughts |
| `src/game/scenes/BoardScene.ts` | UPDATE | +6 (jump guard) | Single guard clause, one-line return |
| `src/game/engine/__tests__/clash.test.ts` | CREATE | +73 | Fixture + 3 describe blocks, 10 assertions |

**Total diff:** 4 files, ~126 LOC added/modified, zero lines removed.

## Deviations from Plan

**None.** Implemented exactly as specified in the plan.

## Issues Encountered

**None.** All 7 tasks completed without blocking issues.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `src/game/engine/__tests__/clash.test.ts` | 10 | `initialState` seeding + validation + regression |

10 assertions total: C1 seeding (4), C2 validation (3), C3 regression (3).

## Next Steps

- [ ] Review via `/code-review` if needed
- [ ] Phase 3: write capture rules + elimination win (Sonnet for plan, then haiku for execute)

---

*Implementation completed: 2026-07-16*
