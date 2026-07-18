import type { GameState, PlayerId } from '@pebble/engine';
import { initialState } from '@pebble/engine';
import { MODES } from '@pebble/engine/modes';
import type { RoomCode, SessionToken } from '@pebble/protocol';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@pebble/protocol';

export type Room = {
    code: RoomCode;
    modeId: string;
    state: GameState;
    //  Seat is decided once, at addSocketToRoom, and never re-derived from
    //  position — a live socket's seat must never change just because the
    //  OTHER socket disconnected. See .claude/reviews for the incident this
    //  replaced (array-index derivation swapped seats on reconnect).
    socketSeats: Map<string, PlayerId>;
    tokens: Map<SessionToken, PlayerId>;
    graceTimer: NodeJS.Timeout | null;
    rematchAccepted: Set<PlayerId>;
};

export const rooms = new Map<RoomCode, Room>();

export function generateRoomCode(): RoomCode {
    let code: RoomCode;
    do {
        code = Array.from({ length: ROOM_CODE_LENGTH }, () =>
            ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
        ).join('') as RoomCode;
    } while (rooms.has(code));
    return code;
}

export function generateSessionToken(): SessionToken {
    return Math.random().toString(36).substring(2, 15) as SessionToken;
}

export function createRoom(modeId: string): Room {
    const code = generateRoomCode();
    const mode = MODES[modeId as keyof typeof MODES];
    if (!mode) throw new Error(`Unknown mode: ${modeId}`);

    const room: Room = {
        code,
        modeId,
        state: initialState(mode.engine, modeId),
        socketSeats: new Map(),
        tokens: new Map(),
        graceTimer: null,
        rematchAccepted: new Set(),
    };

    rooms.set(code, room);
    return room;
}

export function getRoom(code: RoomCode): Room | undefined {
    return rooms.get(code);
}

export function addSocketToRoom(room: Room, socketId: string, seat: PlayerId, token: SessionToken): void {
    room.tokens.set(token, seat);
    //  Seat comes from the caller (create hardcodes 1, join hardcodes 2,
    //  rejoin reads it back off room.tokens) — never derived from how many
    //  sockets happen to be connected right now.
    room.socketSeats.set(socketId, seat);
    //  Clear grace timer if rejoining
    if (room.graceTimer) {
        clearTimeout(room.graceTimer);
        room.graceTimer = null;
    }
}

export function removeSocketFromRoom(room: Room, socketId: string, onExpire?: (code: RoomCode) => void): void {
    room.socketSeats.delete(socketId);
    //  Arm grace timer: room auto-deletes after 60s if not rejoined
    if (room.socketSeats.size === 0) {
        room.graceTimer = setTimeout(() => {
            rooms.delete(room.code);
            onExpire?.(room.code);
        }, 60000);
    }
}

export function deleteRoom(code: RoomCode): void {
    const room = rooms.get(code);
    if (room?.graceTimer) {
        clearTimeout(room.graceTimer);
    }
    rooms.delete(code);
}

export function getPlayerSeat(room: Room, socketId: string): PlayerId | undefined {
    return room.socketSeats.get(socketId);
}

export function isRoomFull(room: Room): boolean {
    return room.socketSeats.size === 2;
}

export function rollForRoom(room: Room): void {
    const seat: PlayerId = Math.random() < 0.5 ? 1 : 2;
    //  Update state.current to reflect the rolled seat (seat 1 is red/current)
    room.state.current = seat;
}
