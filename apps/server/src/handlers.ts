import type { Server, Socket } from 'socket.io';
import { applyMoveForSeat } from './authority';
import {
    addSocketToRoom,
    createRoom,
    generateSessionToken,
    getPlayerSeat,
    getRoom,
    isRoomFull,
    removeSocketFromRoom,
    rollForRoom,
} from './rooms';
import type {
    ClientToServerEvents,
    CreateAck,
    JoinAck,
    RejoinAck,
    MoveAck,
    ServerToClientEvents,
    RoomCode,
} from '@pebble/protocol';
import { MODES } from '@pebble/engine/modes';

export function registerHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {
    socket.on('room:create', ({ modeId }, ack) => {
        try {
            const room = createRoom(modeId);
            const token = generateSessionToken();
            addSocketToRoom(room, socket.id, 1, token);
            socket.join(room.code);
            const result: CreateAck = { ok: true, code: room.code, token };
            ack(result);
        } catch (err) {
            const result: CreateAck = { ok: false, reason: 'server-error' };
            ack(result);
        }
    });

    socket.on('room:join', ({ code }, ack) => {
        try {
            const room = getRoom(code);
            if (!room) {
                const result: JoinAck = { ok: false, reason: 'room-not-found' };
                ack(result);
                return;
            }
            if (isRoomFull(room)) {
                const result: JoinAck = { ok: false, reason: 'room-full' };
                ack(result);
                return;
            }
            const token = generateSessionToken();
            addSocketToRoom(room, socket.id, 2, token);
            socket.join(code);
            //  Roll on second join
            rollForRoom(room);
            //  Emit per-socket so each learns their own seat
            for (const [sid, seat] of room.socketSeats) {
                io.to(sid).emit('roll:result', { yourSeat: seat, modeId: room.modeId, state: room.state });
            }
            const result: JoinAck = { ok: true, code, token };
            ack(result);
        } catch (err) {
            const result: JoinAck = { ok: false, reason: 'room-not-found' };
            ack(result);
        }
    });

    socket.on('room:rejoin', ({ code, token }, ack) => {
        try {
            const room = getRoom(code);
            if (!room) {
                const result: RejoinAck = { ok: false, reason: 'room-not-found' };
                ack(result);
                return;
            }
            const seat = room.tokens.get(token);
            if (!seat) {
                const result: RejoinAck = { ok: false, reason: 'bad-token' };
                ack(result);
                return;
            }
            addSocketToRoom(room, socket.id, seat, token);
            socket.join(code);
            const result: RejoinAck = { ok: true, modeId: room.modeId, yourSeat: seat, state: room.state };
            ack(result);
        } catch (err) {
            const result: RejoinAck = { ok: false, reason: 'room-not-found' };
            ack(result);
        }
    });

    socket.on('move', ({ move }, ack) => {
        try {
            const code = Array.from(socket.rooms).find((r) => r !== socket.id) as RoomCode | undefined;
            if (!code) {
                const result: MoveAck = { ok: false, reason: 'room-not-found' };
                ack(result);
                return;
            }
            const room = getRoom(code);
            if (!room) {
                const result: MoveAck = { ok: false, reason: 'room-not-found' };
                ack(result);
                return;
            }
            const seat = getPlayerSeat(room, socket.id);
            if (!seat) {
                const result: MoveAck = { ok: false, reason: 'not-a-player' };
                ack(result);
                return;
            }
            const mode = MODES[room.modeId as keyof typeof MODES];
            const applyResult = applyMoveForSeat(mode.engine, room.state, move, seat);
            if (applyResult.ok) {
                room.state = applyResult.state;
                const result: MoveAck = { ok: true };
                ack(result);
                io.to(code).emit('game:update', { move, state: room.state });
            } else {
                const result: MoveAck = { ok: false, reason: applyResult.reason };
                ack(result);
            }
        } catch (err) {
            const result: MoveAck = { ok: false, reason: 'illegal-move' };
            ack(result);
        }
    });

    socket.on('room:leave', () => {
        const code = Array.from(socket.rooms).find((r) => r !== socket.id) as RoomCode | undefined;
        if (code) {
            const room = getRoom(code);
            if (room) {
                removeSocketFromRoom(room, socket.id);
            }
            socket.leave(code);
        }
    });

    socket.on('disconnect', () => {
        const code = Array.from(socket.rooms).find((r) => r !== socket.id) as RoomCode | undefined;
        if (code) {
            const room = getRoom(code);
            if (room) {
                removeSocketFromRoom(room, socket.id);
            }
        }
    });
}
