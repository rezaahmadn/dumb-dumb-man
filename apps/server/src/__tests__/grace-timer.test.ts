import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoom, rooms, addSocketToRoom, removeSocketFromRoom } from '../rooms';

describe('Grace timer lifecycle', () => {
    beforeEach(() => {
        rooms.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('arms grace timer on last socket disconnect', () => {
        const room = createRoom('well');
        addSocketToRoom(room, 'socket1', 1, 'token1');
        removeSocketFromRoom(room, 'socket1');
        expect(room.graceTimer).not.toBeNull();
    });

    it('clears grace timer on rejoin', () => {
        const room = createRoom('well');
        addSocketToRoom(room, 'socket1', 1, 'token1');
        removeSocketFromRoom(room, 'socket1');
        const timerBefore = room.graceTimer;
        addSocketToRoom(room, 'socket2', 1, 'token1');
        expect(room.graceTimer).toBeNull();
        expect(timerBefore).not.toBeNull();
    });

    it('auto-deletes room after 60s grace expiry', () => {
        const room = createRoom('well');
        const code = room.code;
        addSocketToRoom(room, 'socket1', 1, 'token1');
        removeSocketFromRoom(room, 'socket1');
        expect(rooms.has(code)).toBe(true);
        vi.advanceTimersByTime(60001);
        expect(rooms.has(code)).toBe(false);
    });

    it('survives grace window with rejoin before expiry', () => {
        const room = createRoom('well');
        const code = room.code;
        addSocketToRoom(room, 'socket1', 1, 'token1');
        removeSocketFromRoom(room, 'socket1');
        vi.advanceTimersByTime(30000);
        addSocketToRoom(room, 'socket2', 1, 'token1');
        vi.advanceTimersByTime(40000);
        expect(rooms.has(code)).toBe(true);
    });
});
