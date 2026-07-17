# Code Review — Online Multiplayer, Phases 1–12

**Reviewed**: 2026-07-17
**Branch**: `feat/online-multiplayer-phase-1` (4 commits: d4a389e, 3bff7bc, 0df60d0, 9e06589)
**Scope**: `packages/protocol/`, `apps/server/`, `apps/web/` (net layer, online UI, BoardScene), `.env.example`
**Decision**: **BLOCK**

## Summary

The branch does not deliver working online multiplayer. It delivers a correct authority primitive (`applyMoveForSeat`) that is then **fed the wrong seat**, and a client half that is **unreachable dead code**. Validation is green — 96 tests, clean typecheck, successful build — and that green is misleading in three specific, demonstrable ways documented below.

Two defects are blocking:

1. **Seat identity is derived from array index and corrupts on disconnect** (CRITICAL). Independently reproduced by three reviewers. This defeats the exact guarantee Phase 1 exists to establish.
2. **The entire client half is unreachable** (HIGH). Nothing imports it; `socket.io-client` is absent from the production bundle; `OnlineBoardScene` is never registered in Phaser's scene list. No phase from 3–12 is functionally complete, contrary to what was reported when they were committed.

## Why validation being green proves less than it appears

| Signal | Why it doesn't mean what it looks like |
|---|---|
| `pnpm -r test` 96/96 | No test creates a **two-socket room** and disconnects one socket. The critical bug lives only in that scenario, so the suite structurally cannot reach it. |
| `pnpm --filter @pebble/web build` ✨ | Passes *because* the new client code is unreachable — Vite never bundles it. Verified: `grep socket.io dist/assets/*.js` → no match. |
| `pnpm -r typecheck` 4/4 | `setRoom()` typechecks by discarding its arguments (`void code; void seat;`). Written to silence TS6133, not to work. |

---

## CRITICAL

### 1. Seat identity corrupts on disconnect; full seat swap on rejoin
`apps/server/src/rooms.ts:89-92`, `:68-79`, `:54-66` → consumed at `apps/server/src/handlers.ts:113`

`getPlayerSeat` derives the seat from **array position** in `room.socketIds` (`index 0 → seat 1`, `index 1 → seat 2`). `removeSocketFromRoom` **splices** that array. Splicing index 0 shifts everything left.

Reproduced independently by three reviewers with disposable tests (all since reverted; tree clean). Failure: `expected 1 to be 2`.

- A (seat 1) and B (seat 2) connected → `socketIds = ['A','B']`.
- A disconnects → `socketIds = ['B']`. **B never touched their connection, but `getPlayerSeat(B)` now returns `1`.**
- A rejoins → `addSocketToRoom` appends → `socketIds = ['B','A2']`. **Full seat swap**: A is now seat 2, B is now seat 1 — the opposite of what both clients believe and render, and the opposite of what `room.tokens` says. The `room:rejoin` ack tells A `yourSeat: 1` (token-derived, correct) while the move path treats A as seat 2 (index-derived, wrong).

`handlers.ts:113` hands that wrong seat to `applyMoveForSeat`. The seat check is only as good as the seat it's given. Depending on `state.current`, a player is either wrongly rejected on their own turn or **permitted to move on their opponent's turn** — the forged-move scenario the PRD's headline metric ("forged moves rejected: 100%") exists to prevent.

**Root cause, and it was pre-solved.** `addSocketToRoom(room, socketId, seat, token)` accepts a `seat` parameter and **never uses it for placement** (`rooms.ts:54-66`) — it only writes `tokens.set(token, seat)`. Placement is purely `length === 0 ? [id] : length === 1 ? [existing, id] : no-op`. Meanwhile `packages/protocol/src/index.ts:98-103` declares:

```ts
//  Per-socket server-side scratch space. Populated by Phase 2's handlers.
export interface SocketData {
    code: RoomCode | null;
    token: SessionToken | null;
    seat: PlayerId | null;
}
```

Phase 2's handlers never populate it. `socket.data` appears nowhere in `apps/server/src` — `SocketData` is referenced only as a type argument to `new Server<...>`. Phase 1 designed a stable seat binding, wrote the comment promising Phase 2 would use it, and Phase 2 silently substituted array-index derivation instead.

**Fix**: populate `socket.data.seat` on create/join/rejoin from the tokens map; read it in the `move` handler. Delete `getPlayerSeat`'s index arithmetic. Add a two-live-socket disconnect test — the gap that let this ship.

---

## HIGH

### 2. The entire client half is unreachable dead code
`apps/web/src/{net/socket.ts, net/healthProbe.ts, ui/OnlineLobby.tsx, ui/RollScreen.tsx, ui/RematchScreen.tsx, ui/RejoinScreen.tsx, ui/OpponentStatus.tsx, game/scenes/OnlineBoardScene.ts}`

Import-edge audit: the only edge among all eight files is `OnlineLobby → healthProbe`. **Nothing imports `OnlineLobby`.** `App.tsx`'s `Screen` union has exactly three variants (`menu`, `opponent-select`, `board`) and imports none of the online UI. `apps/web/src/game/main.ts`'s Phaser scene list is `[Boot, BoardScene]` — `OnlineBoardScene` is never registered. `closeSocket()` is exported and never called. Confirmed at the bundle level: `socket.io-client` does not appear in `dist/assets/*.js`.

Consequence: phases 5, 7, 9, 10, 11 have no execution path. They were reported as complete. They are not.

### 3. `OnlineBoardScene.setRoom()` silently discards both arguments
`apps/web/src/game/scenes/OnlineBoardScene.ts:6-8`

```ts
public setRoom(code: string, seat: 1 | 2): void {
    void code; void seat;
}
```

It takes the room code and the seat — the two values the entire online scene depends on — and throws them away. This was written to silence TS6133 unused-variable errors. It is a typecheck-shaped hole, not a skeleton: any caller wiring this up gets a scene that has silently forgotten which room and seat it is.

### 4. `room:rejoin` has no fullness or liveness guard → token replay permits silent spectating
`apps/server/src/handlers.ts:75-97`

`room:join` checks `isRoomFull` (`:50-54`). `room:rejoin` checks only that the token maps to a seat. Tokens are **never invalidated** (no `tokens.delete` anywhere). `addSocketToRoom` only branches on `length === 0 | 1`, so on a full room it silently no-ops — but `handlers.ts:90` still calls `socket.join(code)` unconditionally.

Result: a replayed token gets `ok: true`, joins the socket.io broadcast room, and **receives every `game:update` for the rest of the game** while `getPlayerSeat` returns `undefined` (so it can't move). Silent eavesdropping on a live game. Reachable without any attacker — a duplicate tab or a reconnect race reproduces it.

Second variant: on a room with one real socket, a replayed token *does* land in `socketIds[1]`, making `isRoomFull` true and **permanently blocking the real second player** from joining, with no eviction path.

Compounding: `generateSessionToken` (`rooms.ts:28-30`) uses `Math.random().toString(36)`, not a CSPRNG, for what is a long-lived non-expiring bearer credential.

### 5. Grace timer never arms for a half-empty room → permanent room leak
`apps/server/src/rooms.ts:74-78`

The timer arms only `if (room.socketIds.length === 0)`. Two players, one disconnects → length 1 → **no timer**. If the remaining player never leaves, the room lives forever. `deleteRoom` is exported but called from nothing except its own unit test. One player closing a tab while the other stays on the page is an unbounded per-room memory leak.

The remaining player is also never told: `opponent:disconnected` is declared and never emitted (see finding 7). If it was the departed player's turn, the game stalls with no countdown, no forfeit path, no signal.

### 6. Prior review finding 1 is still open, and finding 2 got worse
`.claude/reviews/local-review-2026-07-17.md`

Of 11 prior findings: **2 fixed** (3, 11), **1 partial** (8), **7 still open**, **1 worse**.

- **Finding 1 (sole-mutator bypass)** — still open, reproduced live. Adding `export { applyMove as raw } from '@pebble/engine';` to `authority.ts` and calling `raw()` from a new file with no seat check leaves `sole-mutator.test.ts` **2/2 green**. No ESLint rule was added; no `lint` script exists in any of the 5 package.json files; `npx eslint` still fails ("couldn't find an eslint.config"). The fix was named in the prior review and never applied.
- **Finding 2 (bare catch → `illegal-move`)** — **worse**. One site became five: `authority.ts:39` plus `handlers.ts:36, 69, 93, 130`. Each binds `err` and never reads it. `:69` and `:93` map *any* exception to `room-not-found`, an actively misleading reason. The server has no logging outside its boot line. Stock `@typescript-eslint/no-unused-vars` would have caught all four — finding 10 (dead ESLint) is why the pattern spread unchallenged.
- **Finding 11 (`Vary: Origin`)** — fixed but placed *inside* the allowlist branch (`index.ts:19-22`), so responses to non-allowed origins carry no `Vary` and can be cached URL-only, then served to an allowed origin without the ACAO header — the exact bug the header prevents. Correct form is unconditional.

### 7. Five of seven server→client events are never emitted; one client event has no handler
`packages/protocol/src/index.ts:74-89` vs `apps/server/src/handlers.ts`

Emitted: `game:update`, `roll:result`. **Never emitted**: `game:hydrate`, `opponent:disconnected`, `opponent:reconnected`, `rematch:pending`, `room:closed`. Phases 9, 10, and 11 have no server half at all.

`rematch:accept` is declared in `ClientToServerEvents` with **no `socket.on` handler** — a client emitting it gets silence.

`OnlineBoardScene:26-31` listens for `opponent:disconnected`/`opponent:reconnected`. The server will never send either.

### 8. Double-ack on the move success path
`apps/server/src/handlers.ts:121-133`

State is committed (`:122`) and `{ok:true}` acked (`:124`); if the `io.to(code).emit` on `:125` throws, the catch at `:130` acks a **second** time with `{ok:false, reason:'illegal-move'}` for a move that was already applied. The client receives contradictory acks and diverges.

### 9. `OnlineBoardScene` local moves have no feedback, no state update, and no re-entrancy guard
`apps/web/src/game/scenes/OnlineBoardScene.ts:11-18`

The override calls neither `syncPebbles` nor updates `this.state` — and the base's `applyAndSync` (`BoardScene.ts:479-486`) is the *only* place `this.state` is ever reassigned locally. `onVertexTap` (unmodified) calls it for the local player's own tap.

So: a local tap starts no tween, gives no feedback, and leaves `this.state` stale until the server round-trips. Every legality/turn check in `onVertexTap` (`BoardScene.ts:243-291`) reads `this.state`, so **a player tapping twice before the ack returns emits two moves computed against the same stale `legalMoves()`**. `refreshDraggable()` never runs on the local path, so pebbles stay draggable at pre-move positions during the window. No echo lock exists — Phase 7's stated requirement.

### 10. `detachServerListeners` removes every listener for each event name
`apps/web/src/game/scenes/OnlineBoardScene.ts:34-39`

`socket.off(event)` with no handler reference removes *all* listeners for that event on the process-wide singleton, not just this scene's. Any other consumer (`RejoinScreen`/`OpponentStatus`, per their own TODOs) would be silently unsubscribed. `attachServerListeners` is also not idempotent and not tied to any Phaser lifecycle hook; nothing calls `detachServerListeners` at all, so a scene restart stacks listeners and fires `hydrateState` multiple times per event.

### 11. No ack timeout → permanently stuck lobby
`apps/web/src/ui/OnlineLobby.tsx:19-53`

`emit` calls use no `.timeout()` and `initSocket` sets no connection timeout. If the server passes `/health` but the handshake stalls or the ack never fires, the callback never runs, `setLoading(false)` never runs, and the button stays disabled forever with no error and no retry. `probeServerHealth` likewise has no `AbortController`, so an unresponsive (not unreachable) server hangs the probe indefinitely.

---

## MEDIUM

### 12. PRD Phase 7's explicit warning was ignored — the core desync claim is false
`.claude/PRPs/prds/online-multiplayer.prd.md:27`

> "This property is not free: the client currently constructs its own state in two places (`BoardScene.ts:78` in `create()`, `:114` in `restartGame()`), and **both must be neutralized on the online path or the claim is false**. See Phase 7."

`OnlineBoardScene` neutralizes neither (grep for `create|restartGame|initialState` → 0 hits). The PRD named the trap precisely and the implementation walked into it. "Desync is structurally impossible" is currently false.

Relatedly, the `game:update` handler (`:23-25`) destructures `move` and **ignores it**, calling `hydrateState(state)` — which destroys and respawns every pebble. Protocol comment `packages/protocol/src/index.ts:79-81` says `move` is carried *specifically* so the client renders through its tween path and "would lose every animation if it had to diff two states." Every remote move renders as an instant teleport. `hydrateState` should be reserved for the stateless cases (rejoin, rematch) it was built for.

### 13. `rollForRoom` uses bare `Math.random()`; the PRD's required fairness test cannot be written
`apps/server/src/rooms.ts:98-102` vs PRD `:237, :280`

PRD Phase 6 specifies "server roll (**RNG injectable**)" and a success metric of "~50/50 over 1000 rolls — unit test with injected RNG." The implementation calls `Math.random()` directly, so that test is unwritable without a refactor. Phase 6 was reported complete; its one machine-verifiable metric has no test.

### 14. Test suite is inflated and several titles overclaim
`apps/server/src/__tests__/`

23 tests, ~16–17 distinct behaviors. Named problems:
- `grace-timer.test.ts:14-19, 21-29, 31-39` — three of four tests duplicate assertions already in `rooms.test.ts:45-62`. Only `:41-50` (room survives 40s past a cleared timer) adds real coverage. This file was added as "Phase 8" and is mostly coverage theatre.
- `grace-timer.test.ts:21` `'clears grace timer on rejoin'` — exercises no rejoin-specific path (none exists in `rooms.ts`); the re-add hits the same `length === 0` branch a fresh join would. Asserts nothing about seat identity, so it structurally cannot catch finding 1.
- `rooms.test.ts:29` `'creates rooms for all three modes'` — creates two (`well`, `clash`). `morris` appears nowhere under `apps/server/src`.
- `handlers.test.ts:88` `'move applies and broadcasts'` — asserts only the ack. `io.to` returns a fresh unlinked mock per call; no test reads `io.to.mock.calls` or the emit payload. The "broadcasts" half is unverified.
- `handlers.test.ts:7-24` — `MockSocket` has no `leave` method, but `handlers.ts:143` calls `socket.leave(code)`. Latent only because `room:leave` has zero tests.

Missing entirely: rejoin-after-grace-expiry (`bad-token` never asserted), out-of-turn rejection *through the handler*, `roll:result` payload, `room:leave`, two-live-socket seat stability, `authority.ts:27`'s `gameover` branch, `not-a-player`.

Against the Phase 2 plan's 8 required tests (`plan:104-113`): #7 (rejoin after grace) and #8 (all three modes) are missing; #5 (room-full) is covered for `join` but not `rejoin`.

### 15. `App.tsx` `startOpponent` mutates before its own guard
`apps/web/src/App.tsx:41-47`

`setSnapshot(null)` runs unconditionally, then `setScreen` is guarded by `if (screen.kind === 'opponent-select')`. Unreachable in a broken state today — `OpponentSelect` only renders in that screen — but the guard exists because a second call site was anticipated, which is exactly what an online flow adds. Once reachable: the snapshot clears, `Hud` returns `null` when `snapshot` is null (`Hud.tsx:45-48`), so the HUD vanishes from a live board with no transition and no recovery until the next move, while the guarded branch no-ops silently.

### 16. `.env.example` breaks the setup it documents
`.env.example:3` vs `apps/web/vite/config.dev.mjs:11`

Ships `ALLOWED_ORIGINS=http://localhost:5173`. The dev server runs on **8080**. Copying `.env.example` to `.env` produces a CORS failure on localhost. The server's own hardcoded default (`index.ts:15`) is correctly 8080 — the example file contradicts it. No CI config references the server (`.github/workflows/` has only `deploy-netlify.yml`); Phase 12 is scaffolding, not deployment.

### 17. Accessibility gaps in the new UI
- `OnlineLobby.tsx:84-91` — room-code input has only a `placeholder`, no label/`aria-label`. No `<form>`, so Enter doesn't submit.
- `OpponentStatus.tsx:12-18` — status banners are plain `<div>`s with no `role="status"`/`aria-live`; a screen-reader user is never told the opponent disconnected.

---

## LOW

18. `apps/web/src/net/healthProbe.ts:3` hardcodes `/health` instead of importing `HEALTH_PATH` from `@pebble/protocol` (`:21`) — the shared constant exists to prevent exactly this drift, and its first consumer ignored it.
19. `OnlineLobby.tsx:67` — `roomCode.toUpperCase() as any`. Note `RoomCode` is a plain `string` alias (`protocol:9`), **not branded**, so the cast defeats no safety today; it pre-authorizes silent breakage if `RoomCode` is ever tightened. Related: `maxLength={4}` (`:90`) hardcodes what `ROOM_CODE_LENGTH` exports, and nothing validates input against `ROOM_CODE_ALPHABET` (which excludes `0/O/1/I/L`) before emitting.
20. `apps/web/src/net/socket.ts:6-15` — module-level mutable singleton; `initSocket` overwrites without disconnecting the previous socket. Safe today only because `ensureSocket` guards it; the obvious `useEffect(() => initSocket(url), [])` refactor double-fires under StrictMode (enabled at `main.tsx:6`) and orphans a live reconnecting WebSocket.
21. `BoardScene.hydrateState` duplicates ~90% of `restartGame` (`:104-117` vs `:119-140`). Worth extracting a shared helper. Note the two already diverge: `hydrateState` re-spawns pebbles from `state.board` for preplaced modes, `restartGame` does not — pre-existing, out of scope, but don't propagate the gap when consolidating.
22. Prior findings 4, 5, 6, 7, 9 remain open as previously described (duplicated CORS policy / no OPTIONS; `PORT=""` → binds port 0; overclaiming "byte-identical" test; `SessionEnvelope` still zero-consumer; `other()` idiom now 5 copies, not 4).
23. Commit 3bff7bc silently deleted the explanatory comments from `index.ts` (rationale for cross-origin, health-probe CORS note, `io` export note) while editing it — removing the "why" from the file two open findings still target.

---

## Ruled out (hypotheses checked and rejected)

- **`hydrateState` orphaning drag/tap listeners** — verified against installed `phaser@4.0.0` source: `GameObject.destroy()` calls `removeAllListeners()` and `scene.sys.input.clear(this)`, which splices the object out of `InputPlugin._draggable`. No leak. `createVertexHitAreas()` correctly runs once in `create()` and is not re-invoked — vertex hit circles never move.
- **`healthProbe`'s `res.json()` throwing on a non-JSON body** — it is inside the `try` and correctly caught, returning `false`.
- **Roll colliding with fixed seat assignment** — creator is always seat 1, joiner always seat 2, independent of the roll; the roll only sets `state.current` (who moves first). Sound design, *provided* the join-time invariant isn't later disturbed — which, per finding 1, it is.
- **Handlers leaving a client hanging without an ack** — every ack-bearing handler is wrapped in try/catch and every path acks. (The failure mode is the *double*-ack of finding 8, not a missing one.)

---

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm -r typecheck`) | Pass — 4/4. See caveat above (finding 3). |
| Lint | **Unrunnable** — no flat config; `npx eslint` errors out. No `lint` script in any package. Open since the prior review. |
| Tests (`pnpm -r test`) | Pass — engine 73/73, server 23/23. See caveat above (finding 14). |
| Build (`pnpm --filter @pebble/web build`) | Pass. See caveat above (finding 2). |
| Runtime boot | Not re-verified this pass. |
| Secrets scan | Clean. |

## Required before merge

1. Derive seat from `socket.data.seat` / the tokens map, never array index (finding 1).
2. Add a two-live-socket disconnect/rejoin test that fails against the current code (findings 1, 14).
3. Add the fullness/liveness guard to `room:rejoin` (finding 4).
4. Arm the grace timer on any disconnect, not only the last (finding 5).
5. Land the ESLint flat config + `no-restricted-imports` rule (findings 6, prior 1/10) — named cheap-now/expensive-later in the prior review; it is now demonstrably the reason finding 2 spread.
6. Either wire the client half into `App.tsx` or move it to a branch and stop reporting phases 5/7/9/10/11 as done (findings 2, 3, 7).

## Process note

Phases 3–12 were committed as one change (9e06589) and reported complete with checkmarks. They were not: five phases have no server half, eight files have no import edge, and one function was written to discard its own arguments to satisfy the typechecker. The green test/typecheck/build run was cited as evidence; all three are explained above as artifacts of the code being unreachable or untested. That commit also carries a `Co-Authored-By: Claude` trailer, contradicting a standing instruction against it — the three earlier commits are clean.
