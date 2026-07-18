//  Wire contract shared by @pebble/server and @pebble/web. Defined once, in a
//  package both sides depend on, so a payload shape cannot drift between them.
//
//  Almost everything here is a type. The two runtime constants (the room-code
//  alphabet and the health path) are values precisely because both sides must
//  agree on them at runtime, not just at compile time.
import type { GameState, Move, PlayerId } from '@pebble/engine';

export type RoomCode = string;
export type SessionToken = string;

//  Room codes get read aloud over voice chat, so the alphabet drops every
//  glyph pair that sounds or looks alike: 0/O and 1/I/L. 31 symbols, length
//  4 => 31^4 = 923,521 combinations. Collisions are still possible and the
//  generator (Phase 2) must retry on one; this is not a uniqueness guarantee.
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

//  Plain HTTP, not a socket handshake: the client probes this before it will
//  render the Online button, and a probe must be cheaper than a connection.
export const HEALTH_PATH = '/health';
export interface HealthResponse {
    ok: true;
}

export type JoinFailure = 'bad-code' | 'room-not-found' | 'room-full';
export type RejoinFailure = 'bad-code' | 'room-not-found' | 'bad-token';
export type MoveRejection =
    | 'room-not-found'
    | 'not-a-player'
    | 'not-your-turn'
    | 'illegal-move'
    | 'game-over';
export type RoomClosedReason = 'opponent-left' | 'grace-expired' | 'server-shutdown';

//  What a client must persist to survive a reload. The token alone is not
//  enough: modeId is needed at Phaser boot time, before a rejoin round-trip
//  can complete. See PRD Phase 10.
export interface SessionEnvelope {
    token: SessionToken;
    code: RoomCode;
    modeId: string;
}

export type CreateAck =
    | { ok: true; code: RoomCode; token: SessionToken }
    | { ok: false; reason: 'server-error' };

//  yourSeat is returned directly in the ack, not just via the 'roll:result'
//  broadcast: a joiner's own client attaches its 'roll:result' listener only
//  AFTER this ack resolves (see App.tsx's screen-transition-then-subscribe
//  flow), but the server emits 'roll:result' to both sockets synchronously
//  inside the same handler, before this ack is sent — so the joiner's own
//  copy of that broadcast arrives before anything is listening for it and is
//  permanently missed. The creator has no such race (their listener is
//  already attached, waiting, since room creation) and still relies on the
//  broadcast. Found via two-browser playtest, not by inspection.
export type JoinAck =
    | { ok: true; code: RoomCode; token: SessionToken; yourSeat: PlayerId }
    | { ok: false; reason: JoinFailure };

export type RejoinAck =
    | { ok: true; modeId: string; yourSeat: PlayerId; state: GameState }
    | { ok: false; reason: RejoinFailure };

export type MoveAck = { ok: true } | { ok: false; reason: MoveRejection };

export interface ClientToServerEvents {
    'room:create': (payload: { modeId: string }, ack: (result: CreateAck) => void) => void;
    'room:join': (payload: { code: RoomCode }, ack: (result: JoinAck) => void) => void;
    'room:rejoin': (
        payload: { code: RoomCode; token: SessionToken },
        ack: (result: RejoinAck) => void
    ) => void;
    'room:leave': () => void;
    'rematch:accept': () => void;
    //  Intent, not instruction: the server decides whether this becomes a
    //  move. The ack reports acceptance; the resulting state arrives on
    //  'game:update' to every seat, including the sender.
    move: (payload: { move: Move }, ack: (result: MoveAck) => void) => void;
}

export interface ServerToClientEvents {
    //  Sent per-socket (each seat learns only its own), once both seats are
    //  filled and the server has rolled.
    'roll:result': (payload: { yourSeat: PlayerId; modeId: string; state: GameState }) => void;
    //  Carries the move as well as the state: the client renders the move
    //  through its existing tween path and would lose every animation if it
    //  had to diff two states. See PRD Architecture Notes.
    'game:update': (payload: { move: Move; state: GameState }) => void;
    //  Stateless render — an arbitrary position with no move that produced
    //  it. Used by rejoin and rematch, which have no move to animate.
    'game:hydrate': (payload: { state: GameState }) => void;
    'opponent:disconnected': (payload: { graceMs: number }) => void;
    'opponent:reconnected': () => void;
    'rematch:pending': () => void;
    'room:closed': (payload: { reason: RoomClosedReason }) => void;
}

//  No server-to-server events: this is a single instance by design (see the
//  PRD's "Won't build: horizontal scaling"). Declared empty rather than
//  omitted because SocketData is socket.io's 4th generic and cannot be
//  reached without passing this one.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InterServerEvents {}

//  Per-socket server-side scratch space. Populated by Phase 2's handlers.
export interface SocketData {
    code: RoomCode | null;
    token: SessionToken | null;
    seat: PlayerId | null;
}
