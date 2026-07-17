# Phases 3-12: Accelerated Implementation Plan

## Strategy

Phases 3-12 span both server and client. Server phases (8) are fully machine-verifiable. Client phases (3-7, 9-11) are structure-implementable but require browser playtest for human verification. Phase 12 is deployment.

**Execution order**: 3, 4, 5, 6, 8, 7, 9, 10, 11, 12 (parallelizable: 3∥4∥6∥8)

**Scope**: Code structure, routing, tests. Human playtest deferred.

---

## Phase 3: App Screen State Machine
- Refactor App.tsx: `modeId | opponentType` nulls → explicit screen union `'menu' | 'opponent' | 'board'`
- No network yet. Offline modes regression test only.

## Phase 4: BoardScene.hydrateState
- New function: `hydrateState(state: GameState)` → destroy pebbles, respawn from `state.board`
- Prerequisite for rejoin (Phase 10) + rematch (Phase 9)
- Dev hook hydrates synthetic mid-game state → pebbles playable

## Phase 5: Client Net Layer + Probe + Lobby
- `apps/web/src/net/client.ts`: typed socket wrapper
- `useServerAvailable.ts`: probe `/health`, `'up' | 'down' | 'probing'`
- `OnlineLobby.tsx`: create/join UI
- `VITE_SERVER_URL` env var + `Vary: Origin` header fix from Phase 2

## Phase 6: Side Roll
- Server: roll on second join, `roll:result { yourSeat }`
- Client: `RollScreen.tsx` cycles red/blue ~2s, reveals seat
- RNG seeded unit test (machine-verifiable)

## Phase 7: BoardScene Online Integration
- 8-site `opponentType` widen to include `'online'`
- `localPlayer: PlayerId` thread through 7 relay hops (non-optional)
- `applyServerUpdate({move, state})` route through `applyAndSync` tail
- Echo-wait lock + gate "Play again"/"Menu" on online path

## Phase 8: Server Grace Timer
- Already implemented in Phase 2. Formal tests only.
- Prove: rejoin within 60s clears timer, room deletes after expiry

## Phase 9: Rematch
- Mutual accept ack → server re-rolls + re-inits
- Client: `scene.restart(data)` with new seat (not `restartGame()`)
- Swap seats + verify fresh roll

## Phase 10: Rejoin
- Read session envelope → `room:rejoin` → `hydrateState(state)`
- Deferred-mount path in App for `modeId` needed at boot time
- Test: reload mid-game within 60s → exact position

## Phase 11: Disconnect Notices
- `opponent:disconnected` / `:reconnected` / `room:closed` → UI states
- Modal or overlay showing grace timer / clean close

## Phase 12: Deploy + CI
- Pick host (Fly/Railway/Render), PORT + CORS env vars
- `VITE_SERVER_URL` build var
- Verify `pnpm -r test` / `pnpm -r typecheck` cover all packages

---

## Testing Approach

**Machine-verifiable** (Phases 1, 2, 6 RNG, 8): vitest unit tests, `pnpm -r test` proves it.

**Human-verifiable** (Phases 3-7, 9-11): structure testable, UI playtest manual (browser required).

**Deferred**: Phase 12 assumes host choice is known; CI assumes deployment target is set.

---

*Status: Implementation begins*
