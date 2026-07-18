# Implementation Report: Online Multiplayer Phase 1: Protocol + Server Scaffold + Authority

## Summary

Created `@pebble/protocol` (wire contract) and `@pebble/server` (authoritative socket.io process with anti-cheat boundary). The server boots, answers `/health`, and enforces `applyMoveForSeat` as the sole mutator—turning-check structural guard verifies no code can bypass it. Protocol types socket events; server source is pure TypeScript (no build step). Both packages integrate into the pnpm workspace immediately.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | High (spike-verified) | High |
| Files Changed | 10 created, 0 modified | 10 created, 0 modified |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Create `packages/protocol/package.json` | ✓ Done | PACKAGE_SHAPE mirror, no `test` script (N/A). |
| 2 | Create `packages/protocol/tsconfig.json` | ✓ Done | TSCONFIG_SHAPE, `lib: ["ES2020"]` no DOM. |
| 3 | Create `packages/protocol/src/index.ts` | ✓ Done | Full wire contract: event types, room codes, socket.io generics. |
| 4 | Create `apps/server/package.json` | ✓ Done | PACKAGE_SHAPE, **`test` script present** (critical). |
| 5 | Create `apps/server/tsconfig.json`, run install | ✓ Done | TSCONFIG_SHAPE + Node types; `pnpm install` created workspace symlinks. |
| 6 | Create `apps/server/vitest.config.ts` | ✓ Done | VITEST_CONFIG_SHAPE, broad include glob. |
| 7 | Create `apps/server/src/authority.ts` | ✓ Done | `applyMoveForSeat` sole mutator, seat check before `applyMove`. |
| 8 | Create `apps/server/src/__tests__/authority.test.ts` | ✓ Done | A1 turn-ownership tests using `legalMoves(cfg, s)[0]` from wrong seat. |
| 9 | Create `apps/server/src/__tests__/sole-mutator.test.ts` | ✓ Done | A2 structural guard scanning for unauthorized `applyMove` imports. |
| 10 | Create `apps/server/src/index.ts` | ✓ Done | HTTP server, `/health` endpoint, socket.io attached. |
| 11 | Prove validation | ✓ Done | All checks passed; guard bite-verified. |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | ✓ Pass | Zero errors: `pnpm -r typecheck` clean. |
| Unit Tests | ✓ Pass | 7 tests in @pebble/server (A1×5 + A2×2); 73 in @pebble/engine (no regression). |
| Build | ✓ Pass | No build step required; raw `.ts` exports verified. |
| Integration | ✓ Pass | Server boots under `tsx`, `/health` returns 200 `{"ok":true}`, CORS headers present. |
| Edge Cases | ✓ Pass | A1.4: state untouched on rejection; A1.5: illegal move catch; A2: guard catches unauthorized imports. |
| Guard Bite Test | ✓ Pass | Temporarily added `import { applyMove }` to index.ts → A2 failed; removed → A2 passed. |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `packages/protocol/package.json` | CREATED | +22 |
| `packages/protocol/tsconfig.json` | CREATED | +10 |
| `packages/protocol/src/index.ts` | CREATED | +119 |
| `apps/server/package.json` | CREATED | +28 |
| `apps/server/tsconfig.json` | CREATED | +11 |
| `apps/server/vitest.config.ts` | CREATED | +10 |
| `apps/server/src/authority.ts` | CREATED | +46 |
| `apps/server/src/__tests__/authority.test.ts` | CREATED | +68 |
| `apps/server/src/__tests__/sole-mutator.test.ts` | CREATED | +48 |
| `apps/server/src/index.ts` | CREATED | +49 |

## Deviations from Plan

None. Implemented exactly as planned.

## Issues Encountered

None. Validation chain ran clean.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/server/src/__tests__/authority.test.ts` | 5 tests | Turn-ownership boundary: in-turn legal, out-of-turn legal (placement and movement), state immutability, illegal move handling. |
| `apps/server/src/__tests__/sole-mutator.test.ts` | 2 tests | Structural guard: scan non-empty, no unauthorized `applyMove` imports. |

## Acceptance Criteria Met

- [x] All 11 tasks completed.
- [x] `pnpm -r typecheck` clean.
- [x] `pnpm -r test` green with `@pebble/server` 7 tests (non-zero).
- [x] `/health` returns `{"ok":true}`; unknown paths 404.
- [x] `applyMoveForSeat` checks `seat !== state.current` **before** calling `applyMove`.
- [x] A1.2/A1.3 use `legalMoves(cfg, s)[0]` (move legal for current player, submitted from other seat).
- [x] A2 fails when `applyMove` imported outside `authority.ts` (demonstrated, then reverted).
- [x] No file under `apps/web` touched.

## Completion Checklist

- [x] K&R braces (opening brace same line), 4-space indent, `//` + two-space comments (engine style).
- [x] Values via `import {}`, types via `import type {}` (required by `isolatedModules`).
- [x] No unused imports or catch bindings (`catch {}` pattern used).
- [x] `packages/engine` and `apps/web` unmodified.
- [x] No build step or `dist` — raw `.ts` exports (load-bearing).
- [x] Every package has `typecheck` script; every package with tests has `test` script.
- [x] Self-contained — no codebase searching needed during implementation.

---

**Branch**: `feat/online-multiplayer-phase-1`  
**Status**: Ready for `/code-review` and `/prp-pr`
