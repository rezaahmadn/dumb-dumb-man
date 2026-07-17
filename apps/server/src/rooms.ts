import type { GameState, PlayerId } from '@pebble/engine';
import { initialState } from '@pebble/engine';
import { MODES } from '@pebble/engine/modes';
import type { RoomCode, SessionToken } from '@pebble/protocol';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@pebble/protocol';

export type Room = {
    code: RoomCode;
    modeId: string;
    state: GameState;
    socketIds: [string, string] | [string] | [];
    tokens: Map<SessionToken, PlayerId>;
    graceTimer: NodeJS.Timeout | null;
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
        socketIds: [],
        tokens: new Map(),
        graceTimer: null,
    };

    rooms.set(code, room);
    return room;
}

export function getRoom(code: RoomCode): Room | undefined {
    return rooms.get(code);
}

export function addSocketToRoom(room: Room, socketId: string, seat: PlayerId, token: SessionToken): void {
    room.tokens.set(token, seat);
    if (room.socketIds.length === 0) {
        room.socketIds = [socketId];
    } else if (room.socketIds.length === 1) {
        room.socketIds = [room.socketIds[0], socketId];
    }
    //  Clear grace timer if rejoining
    if (room.graceTimer) {
        clearTimeout(room.graceTimer);
        room.graceTimer = null;
    }
}

export function removeSocketFromRoom(room: Room, socketId: string): void {
    const index = (room.socketIds as string[]).indexOf(socketId);
    if (index !== -1) {
        (room.socketIds as string[]).splice(index, 1);
    }
    //  Arm grace timer: room auto-deletes after 60s if not rejoined
    if (room.socketIds.length === 0) {
        room.graceTimer = setTimeout(() => {
            rooms.delete(room.code);
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
    const index = (room.socketIds as string[]).indexOf(socketId);
    return index === 0 ? 1 : index === 1 ? 2 : undefined;
}

export function isRoomFull(room: Room): boolean {
    return room.socketIds.length === 2;
}
