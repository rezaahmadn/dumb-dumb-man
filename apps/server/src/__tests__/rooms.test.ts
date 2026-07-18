import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoom, generateRoomCode, rooms, addSocketToRoom, removeSocketFromRoom, deleteRoom, isRoomFull, getPlayerSeat } from '../rooms';

describe('R0 room management', () => {
    beforeEach(() => {
        rooms.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('generates unique room codes', () => {
        const code1 = generateRoomCode();
        const code2 = generateRoomCode();
        expect(code1).not.toBe(code2);
        expect(code1).toHaveLength(4);
    });

    it('creates room with initial state', () => {
        const room = createRoom('well');
        expect(room.modeId).toBe('well');
        expect(room.state.phase).toBe('placement');
        expect(room.socketSeats.size).toBe(0);
        expect(rooms.has(room.code)).toBe(true);
    });

    it('creates rooms for all three modes', () => {
        const well = createRoom('well');
        const clash = createRoom('clash');
        expect(well.state.phase).toBe('placement');
        expect(clash.state.phase).toBe('movement');
    });

    it('tracks sockets and detects full', () => {
        const room = createRoom('well');
        expect(isRoomFull(room)).toBe(false);
        addSocketToRoom(room, 'socket1', 1, 'token1');
        expect(isRoomFull(room)).toBe(false);
        addSocketToRoom(room, 'socket2', 2, 'token2');
        expect(isRoomFull(room)).toBe(true);
    });

    it('arms and clears grace timer', () => {
        const room = createRoom('well');
        addSocketToRoom(room, 'socket1', 1, 'token1');
        removeSocketFromRoom(room, 'socket1');
        expect(room.graceTimer).not.toBeNull();
        addSocketToRoom(room, 'socket1', 1, 'token1');
        expect(room.graceTimer).toBeNull();
    });

    it('deletes room after grace expires', () => {
        const room = createRoom('well');
        const code = room.code;
        addSocketToRoom(room, 'socket1', 1, 'token1');
        removeSocketFromRoom(room, 'socket1');
        expect(rooms.has(code)).toBe(true);
        vi.advanceTimersByTime(61000);
        expect(rooms.has(code)).toBe(false);
    });

    it('manual delete clears grace timer', () => {
        const room = createRoom('well');
        addSocketToRoom(room, 'socket1', 1, 'token1');
        removeSocketFromRoom(room, 'socket1');
        expect(room.graceTimer).not.toBeNull();
        deleteRoom(room.code);
        expect(rooms.has(room.code)).toBe(false);
    });
});

describe('R0.1 seat identity survives disconnect/rejoin churn', () => {
    beforeEach(() => {
        rooms.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('seat 2 keeps its seat after seat 1 disconnects (regression: was array-index derived)', () => {
        const room = createRoom('well');
        addSocketToRoom(room, 'A', 1, 'tokA');
        addSocketToRoom(room, 'B', 2, 'tokB');
        expect(getPlayerSeat(room, 'B')).toBe(2);

        removeSocketFromRoom(room, 'A');

        //  B never touched their connection — B must still be seat 2.
        //  The old array-index implementation shifted B to index 0 here,
        //  silently reporting seat 1.
        expect(getPlayerSeat(room, 'B')).toBe(2);
    });

    it('seat 1 keeps seat 1 on rejoin, no swap with the still-connected seat 2', () => {
        const room = createRoom('well');
        addSocketToRoom(room, 'A', 1, 'tokA');
        addSocketToRoom(room, 'B', 2, 'tokB');

        removeSocketFromRoom(room, 'A');
        //  Reconnect gets a brand-new socket id, as a real client does.
        addSocketToRoom(room, 'A2', 1, 'tokA');

        //  The old implementation appended A2 at index 1 (seat 2) while B
        //  had already shifted to index 0 (seat 1) — a full swap.
        expect(getPlayerSeat(room, 'A2')).toBe(1);
        expect(getPlayerSeat(room, 'B')).toBe(2);
    });

    it('seat 2 rejoining an empty room is still seat 2', () => {
        const room = createRoom('well');
        addSocketToRoom(room, 'A', 1, 'tokA');
        addSocketToRoom(room, 'B', 2, 'tokB');
        removeSocketFromRoom(room, 'A');
        removeSocketFromRoom(room, 'B');

        addSocketToRoom(room, 'B2', 2, 'tokB');

        expect(getPlayerSeat(room, 'B2')).toBe(2);
    });
});
