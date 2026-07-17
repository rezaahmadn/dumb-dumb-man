# Plan: Online Multiplayer — Phase 2: Room Lifecycle

## Summary

Implement socket.io handlers for room creation, joining, movement, and disconnection. The server becomes the sole authority over game rooms: a `Map<RoomCode, Room>` holds all active games in memory. Every handler calls only `applyMoveForSeat` (Phase 1's structural guard). On disconnect, a 60s grace period allows rejoin; after expiry the room self-deletes. This phase is pure server logic, machine-verifiable via unit tests.

## User Story

As a **room creator**, I want to **receive a 4-character code I can share**, and as a **joiner**, I want to **enter that code and join the board**, so that **two clients can play a complete game with the server holding the only authoritative state**.

(No user-visible UI yet — that is Phases 3–7. This phase proves the server half works.)

## Problem → Solution

The server needs to:
1. Generate short codes collisionless enough for voice communication (4 chars, 31^4 combos, alphabet drops 0/O/1/I/L)
2. Store rooms durably while games are in flight, and auto-cleanup on grace expiry
3. Route every move through `applyMoveForSeat` without exception
4. Broadcast state to both seats identically
5. Reject rejoins after the grace window with a clean error

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/online-multiplayer.prd.md`
- **PRD Phase**: 2 — Room lifecycle
- **Verification class**: **Machine** — `pnpm -r test` proves: in-turn moves apply, out-of-turn moves rejected with state unchanged, unknown rooms rejected, room-full works, rejoin within grace restores exact state
- **Estimated Files**: 5 created (rooms.ts, handlers.ts, *.test.ts), 2 modified (index.ts, package.json)

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `.claude/PRPs/plans/completed/online-multiplayer-phase-1-protocol-authority.plan.md` | — | Phase 1 plan. Phase 2 assumes `applyMoveForSeat` exists and is the sole mutator. |
| **P0** | `packages/protocol/src/index.ts` | 59-89 | `ClientToServerEvents` + `ServerToClientEvents`. Every handler routes exactly one of these. |
| **P0** | `packages/engine/src/types.ts` | 28-47 | `GameState`, `Move`, `PlayerId`. Room holds these; handlers shape them. |
| **P1** | `packages/engine/src/modes/index.ts` | — | The modes list. Room reads `MODES[modeId]` on creation. |
| **P1** | `apps/server/src/authority.ts` | — | `applyMoveForSeat`. Every move handler calls it and only it. |
| **P2** | `packages/engine/src/__tests__/clash.test.ts` | 1-45 | Test conventions: `describe`, `it`, fixtures as const. Server tests follow this shape. |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| socket.io server events | [socket.io events](https://socket.io/docs/v4/server-socket-instance/#Events) | Server listens on `socket.on(event, handler)`. Handler receives `payload` and optional `ack: (result) => void`. Calling `ack(result)` sends back to the sender. |
| socket.io broadcast | [socket.io broadcast](https://socket.io/docs/v4/socket-io-protocol/) | `io.to(roomCode).emit(event, payload)` sends to everyone in that room. `socket.emit(event, payload)` sends to the sender only. |
| socket.io room join | [socket.io rooms](https://socket.io/docs/v4/rooms/) | `socket.join(roomCode)` adds a socket to a room. Messages broadcast to the room hit all sockets in it. |
| Map collision handling | JS Set API | Collision detection: generate code, check `rooms.has(code)`. On collision, regenerate. |
| Timeout / clearTimeout | Node.js | Grace timer uses `setTimeout` on disconnect, `clearTimeout` on rejoin. |

---

## Patterns to Mirror

### ROOM_TYPE_SHAPE
```ts
type Room = {
  code: RoomCode;
  modeId: string;
  state: GameState;
  socketIds: [string, string] | [string] | [];
  graceTimer: NodeJS.Timeout | null;
};
```
**Rule**: `socketIds` tracks connected sockets. Room exists from create; becomes "live" at second join. Grace timer independent — room lingers after disconnect.

### CODE_GEN_PATTERN
```ts
function generateRoomCode(): RoomCode {
  let code: RoomCode;
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () =>
      ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}
```

### HANDLER_SIGNATURE
```ts
socket.on('room:create', ({ modeId }, ack) => {
  ack({ ok: true, code, token } as CreateAck);
});
```

---

## Implementation Checklist

### Files to Create

- [ ] `apps/server/src/rooms.ts` — `Room` type, `rooms: Map`, code gen, grace timer
- [ ] `apps/server/src/handlers.ts` — socket handlers (create, join, rejoin, move, leave)
- [ ] `apps/server/src/__tests__/rooms.test.ts` — room management
- [ ] `apps/server/src/__tests__/handlers.test.ts` — move flow + rejections

### Files to Modify

- [ ] `apps/server/src/index.ts` — wire handlers to `io`

### Tests (PRD success signals)

1. In-turn legal move applies
2. Out-of-turn legal move rejected, state unchanged
3. Illegal move rejected
4. Unknown room rejected
5. Room-full rejection (3rd joiner)
6. Rejoin within 60s grace restores state
7. Rejoin after grace fails
8. All three modes round-trip

---

## Gotchas

### GOTCHA-1: Mock the roll
Tests can't roll randomly. Set `room.state.current` directly to control whose turn it is.

### GOTCHA-2: Socket ID vs SessionToken
`socket.id` = ephemeral connection ID. `SessionToken` = stable room proof (persisted by client). Keep separate.

### GOTCHA-3: Broadcast ordering
Move ack returns immediately to sender; state broadcast goes to both. Client should wait for broadcast (Phase 7 handles echo-lock). Tests verify broadcast is sent.

### GOTCHA-4: Grace timer cleanup
Don't delete room on disconnect — arm timer. Test `rooms.has(code) === false` after expiry, not just a flag.

### GOTCHA-5: All three modes
Create with `modeId: 'well' | 'clash' | 'ultimate'`. Every handler passes `MODES[modeId].engine` to `applyMoveForSeat`.

---

*Status: READY TO IMPLEMENT*
