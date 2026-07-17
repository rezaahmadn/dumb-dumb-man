import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoom, generateRoomCode, rooms, addSocketToRoom, removeSocketFromRoom, deleteRoom, isRoomFull } from '../rooms';

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
        expect(room.socketIds).toEqual([]);
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
