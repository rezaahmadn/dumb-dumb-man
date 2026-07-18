# Local Code Review — Online Multiplayer Phase 1 (Protocol + Server Scaffold + Authority)

**Reviewed**: 2026-07-17
**Branch**: feat/online-multiplayer-phase-1
**Scope**: `packages/protocol/` (new), `apps/server/` (new), `pnpm-lock.yaml` (modified)

## Summary

New `@pebble/protocol` (wire-contract types) and `@pebble/server` (socket.io scaffold + `applyMoveForSeat` anti-cheat boundary). Typecheck and tests are clean across the workspace, no regressions in `@pebble/engine`. No CRITICAL issues. One MEDIUM issue worth fixing before Phase 2 builds on top of it (the sole-mutator guard has a demonstrated bypass), plus a small set of MEDIUM/LOW robustness and scope gaps.

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

1. **`apps/server/src/__tests__/sole-mutator.test.ts:24,38-46`** — the anti-cheat structural guard is a raw substring scan (`/\bapplyMove\b/`) over `.ts` file text, exempting only `authority.ts` by filename. This has a demonstrated, non-obfuscated bypass: `authority.ts` (the one exempt file) can do `export { applyMove as raw } from '@pebble/engine';` — that line lives in the exempt file, so the scan never flags it — and any handler can then `import { raw } from '../authority'` and call it directly, fully bypassing the seat check while the test suite stays green. This is exactly the vacuous-green failure mode the test's own comments warn against, turned against the test itself. Un-exporting `applyMove` from the engine isn't a fix — `apps/web/src/game/scenes/BoardScene.ts:459` legitimately calls it directly for local hotseat play. Better fix: an ESLint `no-restricted-imports` rule scoped to `apps/server` (carving out `authority.ts`) that resolves the actual import origin rather than grepping text — not evadable by rename/re-export. Cheapest to add now, before more server files exist.

2. **`apps/server/src/authority.ts:37-44`** — the bare `catch {}` around `applyMove` maps *any* exception to `reason: 'illegal-move'`, not just the engine's documented illegal-move throw. A future `rules.ts` bug or malformed `EngineConfig` producing a `TypeError` would be reported identically to a normal rule violation, with the original error swallowed and unlogged. Phase 2 loses the ability to distinguish "client cheated" from "server bug," with no diagnostic trail. Consider narrowing the catch or logging before converting to the ack reason.

3. **`apps/server/src/index.ts:18`** — `ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '...').split(',')` doesn't trim entries. The idiomatic `"http://a, https://b"` (comma-space) leaves a leading space on the second origin, silently failing to match both the manual CORS check (line 25) and socket.io's `cors.origin` array (line 47). Reads as a mystery prod CORS outage, not a config typo. Fix: `.split(',').map(o => o.trim())`.

### LOW

4. **`apps/server/src/index.ts:20-36` vs `:41-48`** — the same origin-allowlist policy is implemented twice (hand-rolled for the raw HTTP path, socket.io's `cors` option for the socket handshake), and the raw handler has no `OPTIONS` preflight handling. Invisible today (`/health` is a simple cross-origin GET, no preflight triggered), but the first future plain-HTTP route needing a non-simple request (POST+JSON, custom header) will fail preflight with an opaque 404 — "works with curl, fails only in the browser." Also, the CORS header is set unconditionally for every request including 404s, wider than the comment's stated "the health probe needs its own CORS header" intent (harmless today since the body carries no sensitive data). Consider one shared `isAllowedOrigin()` helper feeding both paths, plus a generic OPTIONS responder.

5. **`apps/server/src/index.ts:12`** — `Number(process.env.PORT ?? 3001)`: `PORT=""` (blank env var, common in templated deploy configs) evaluates to `0`, not `NaN`, so the server silently binds to an OS-assigned ephemeral port instead of failing loud or falling back to 3001. Contrast: `PORT=abc` does fail loud (`NaN` → `RangeError` on `listen`).

6. **`apps/server/src/__tests__/authority.test.ts:50-56`** — the test title "leaves the input state byte-identical when it rejects" overclaims: `positionKey` only encodes board layout + `current`, not `placed`/`phase`/`winner`/`history`, so this assertion can't detect corruption of those fields. Not exploitable today (the seat-check rejection returns before `applyMove` is ever called), just a naming/coverage mismatch.

7. **`packages/protocol/src/index.ts:36-43`** (`SessionEnvelope`) — cites "PRD Phase 10" in its own comment and has zero consumers anywhere in the current tree. Reload-session persistence is several phases past what Phase 2 (room create/join/rejoin/move) actually needs next. Consider adding this interface in the phase that introduces it instead of shipping it ahead of any code exercising it.

8. **`packages/protocol/src/index.ts:12-17`** (`ROOM_CODE_ALPHABET`, `ROOM_CODE_LENGTH`) — unlike the type-only declarations nearby (erased at compile time, verified by any future consumer's typecheck), these are runtime values with zero consumers and zero tests in this PR — nothing currently verifies the alphabet is spelled correctly or that the "31^4 = 923,521" comment is accurate.

9. **Reuse nit** — `other()` in `authority.test.ts:7` (`p === 1 ? 2 : 1`) is the 4th independent copy of the same idiom in this codebase (others in `packages/engine/src/aiGreedy.ts:10` and `rules.ts:185,332`, none exported). Worth hoisting to a shared `otherPlayer` export in `@pebble/engine` next time authority-adjacent code needs it.

10. **Advisory, pre-existing** — the workspace root has no working ESLint setup for TypeScript packages (`.eslintrc.cjs` is v8-style; a bare `npx eslint` resolves ESLint 10, which requires flat config and errors immediately). Not introduced by this PR, and no package defines a `lint` script — Phase 4 validation below skipped lint entirely for lack of a working command. Worth fixing so it doesn't stay silently skipped.

11. **`apps/server/src/index.ts:24-27`** — the origin-echo CORS response (`res.setHeader('Access-Control-Allow-Origin', origin)`) has no accompanying `Vary: Origin`. Standard practice for a multi-origin allowlist that reflects the request's origin back, so a cache sitting in front of the process (CDN, reverse proxy, browser HTTP cache) doesn't serve a response cached for origin A's header value to origin B. No live impact today (`/health` carries no sensitive data, no credentialed requests), but it's the kind of gap that only bites once this process sits behind a shared cache.

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm -r typecheck`) | Pass — 4/4 projects (engine, web, protocol, server) |
| Lint | Skipped — no working ESLint config for TS in this workspace (pre-existing, see Finding 10) |
| Tests (`pnpm -r test`) | Pass — engine 73/73, server 7/7 (new), no regressions |
| Build | N/A by design — no build step for `protocol`/`server` (raw `.ts` exports); `apps/web` untouched |
| Runtime boot | Server boots under `tsx`, `/health` returns `200 {"ok":true}`, CORS header present |
| Secrets scan | Clean — no hardcoded credentials/keys/tokens in new files |
| Lockfile diff | Clean — only expected new deps for `apps/server`/`packages/protocol`, workspace glob already covers both |

## Files Reviewed

- `packages/protocol/src/index.ts` — Added
- `packages/protocol/package.json`, `tsconfig.json` — Added
- `apps/server/src/authority.ts` — Added
- `apps/server/src/index.ts` — Added
- `apps/server/src/__tests__/authority.test.ts` — Added
- `apps/server/src/__tests__/sole-mutator.test.ts` — Added
- `apps/server/package.json`, `tsconfig.json`, `vitest.config.ts` — Added
- `pnpm-lock.yaml` — Modified (new workspace deps only)

## Decision

**APPROVE with comments.** No CRITICAL/HIGH issues, validation green. Finding 1 (sole-mutator guard bypass) is the one worth fixing before Phase 2 adds real handlers — it undermines the exact guarantee this phase exists to establish, and the fix (a scoped ESLint rule) is cheap now, expensive later. Findings 2-3 are cheap now, harder to trace once Phase 2 ships. The rest are advisory.
