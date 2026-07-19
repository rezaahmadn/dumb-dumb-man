import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerHandlers } from '../handlers';
import { rooms } from '../rooms';
import { WELL_MODE } from '@pebble/engine/modes';
import { legalMoves } from '@pebble/engine';

type MockSocket = {
    id: string;
    rooms: Set<string>;
    on: (event: string, handler: Function) => void;
    join: (code: string) => void;
};

function createMockSocket(id: string): MockSocket {
    const socket: any = {
        id,
        rooms: new Set(),
        on: vi.fn(),
        join: (code: string) => {
            socket.rooms.add(code);
        },
        to: (_code: string) => ({ emit: vi.fn() }),
        leave: (code: string) => {
            socket.rooms.delete(code);
        },
    };
    return socket;
}

describe('R1 handlers', () => {
    beforeEach(() => {
        rooms.clear();
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('room:create returns code and token', () => {
        const socket = createMockSocket('test-1');
        const io = { to: vi.fn() };
        registerHandlers(io as any, socket as any);
        const createHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'room:create')[1];
        const ack = vi.fn();

        createHandler({ modeId: 'well' }, ack);

        expect(ack).toHaveBeenCalledWith(
            expect.objectContaining({ ok: true, code: expect.any(String), token: expect.any(String) })
        );
    });

    it('room:join rejects unknown room', () => {
        const socket = createMockSocket('test-2');
        const io = { to: vi.fn() };
        registerHandlers(io as any, socket as any);
        const joinHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'room:join')[1];
        const ack = vi.fn();

        joinHandler({ code: 'XXXX', modeId: 'well' }, ack);

        expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, reason: 'room-not-found' }));
    });

    it('room:join rejects a joiner requesting a different mode than the room', () => {
        const socket1 = createMockSocket('test-1');
        const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
        registerHandlers(io as any, socket1 as any);

        const createHandler = (socket1.on as any).mock.calls.find((c: any) => c[0] === 'room:create')[1];
        const createAck = vi.fn();
        createHandler({ modeId: 'well' }, createAck);
        const { code } = createAck.mock.calls[0][0];

        const socket2 = createMockSocket('test-2');
        registerHandlers(io as any, socket2 as any);
        const joinHandler = (socket2.on as any).mock.calls.find((c: any) => c[0] === 'room:join')[1];
        const joinAck = vi.fn();
        joinHandler({ code, modeId: 'morris' }, joinAck);

        expect(joinAck).toHaveBeenCalledWith(expect.objectContaining({ ok: false, reason: 'mode-mismatch' }));
        //  Rejected joiner must not occupy seat 2 — the room stays open for
        //  the right mode's joiner.
        expect(rooms.get(code)!.socketSeats.size).toBe(1);
    });

    it('room:join rejects third joiner', () => {
        const socket1 = createMockSocket('test-1');
        const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
        registerHandlers(io as any, socket1 as any);
        
        const createHandler = (socket1.on as any).mock.calls.find((c: any) => c[0] === 'room:create')[1];
        const createAck = vi.fn();
        createHandler({ modeId: 'well' }, createAck);
        const { code } = createAck.mock.calls[0][0];

        const socket2 = createMockSocket('test-2');
        registerHandlers(io as any, socket2 as any);
        const joinHandler2 = (socket2.on as any).mock.calls.find((c: any) => c[0] === 'room:join')[1];
        const joinAck2 = vi.fn();
        joinHandler2({ code, modeId: 'well' }, joinAck2);
        expect(joinAck2).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));

        const socket3 = createMockSocket('test-3');
        registerHandlers(io as any, socket3 as any);
        const joinHandler3 = (socket3.on as any).mock.calls.find((c: any) => c[0] === 'room:join')[1];
        const joinAck3 = vi.fn();
        joinHandler3({ code, modeId: 'well' }, joinAck3);
        expect(joinAck3).toHaveBeenCalledWith(expect.objectContaining({ ok: false, reason: 'room-full' }));
    });

    it('move applies and broadcasts', () => {
        const socket = createMockSocket('test-3');
        const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
        registerHandlers(io as any, socket as any);
        
        const createHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'room:create')[1];
        const createAck = vi.fn();
        createHandler({ modeId: 'well' }, createAck);
        const { code } = createAck.mock.calls[0][0];

        socket.rooms.add(code);

        const room = rooms.get(code);
        const moveHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'move')[1];
        const moveAck = vi.fn();
        const move = legalMoves(WELL_MODE.engine, room!.state)[0];

        moveHandler({ move }, moveAck);

        expect(moveAck).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('seat 2 keeps moving on its own turn after seat 1 disconnects and rejoins (regression)', () => {
        const socket1 = createMockSocket('p1');
        const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
        registerHandlers(io as any, socket1 as any);
        const createHandler = (socket1.on as any).mock.calls.find((c: any) => c[0] === 'room:create')[1];
        const createAck = vi.fn();
        createHandler({ modeId: 'well' }, createAck);
        const { code, token: token1 } = createAck.mock.calls[0][0];
        socket1.rooms.add(code);

        const socket2 = createMockSocket('p2');
        registerHandlers(io as any, socket2 as any);
        const joinHandler2 = (socket2.on as any).mock.calls.find((c: any) => c[0] === 'room:join')[1];
        const joinAck2 = vi.fn();
        joinHandler2({ code, modeId: 'well' }, joinAck2);
        socket2.rooms.add(code);

        const room = rooms.get(code);
        //  Force it to be seat 2's turn — the roll is random, this test isn't.
        room!.state.current = 2;

        //  Seat 1 disconnects, then reconnects as a brand-new socket (as any
        //  real reconnect does) and rejoins.
        const disconnectHandler1 = (socket1.on as any).mock.calls.find((c: any) => c[0] === 'disconnect')[1];
        disconnectHandler1();

        const socket1b = createMockSocket('p1-reconnected');
        registerHandlers(io as any, socket1b as any);
        const rejoinHandler = (socket1b.on as any).mock.calls.find((c: any) => c[0] === 'room:rejoin')[1];
        const rejoinAck = vi.fn();
        rejoinHandler({ code, token: token1 }, rejoinAck);
        socket1b.rooms.add(code);

        //  Seat 2's socket never disconnected. It must still be able to move
        //  on its own turn — pre-fix, the array-index-derived seat lookup
        //  would report it as seat 1 the moment seat 1 disconnected, and this
        //  legal seat-2 move would be wrongly rejected as not-your-turn.
        const moveHandler2 = (socket2.on as any).mock.calls.find((c: any) => c[0] === 'move')[1];
        const moveAck2 = vi.fn();
        const move = legalMoves(WELL_MODE.engine, room!.state)[0];
        moveHandler2({ move }, moveAck2);

        expect(moveAck2).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('rejoin within grace works', () => {
        const socket = createMockSocket('test-4');
        const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
        registerHandlers(io as any, socket as any);

        const createHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'room:create')[1];
        const createAck = vi.fn();
        createHandler({ modeId: 'well' }, createAck);
        const { code, token } = createAck.mock.calls[0][0];

        const room = rooms.get(code);
        expect(room).toBeDefined();

        const disconnectHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'disconnect')[1];
        disconnectHandler();
        expect(room!.graceTimer).not.toBeNull();

        const rejoinHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'room:rejoin')[1];
        const rejoinAck = vi.fn();
        rejoinHandler({ code, token }, rejoinAck);

        expect(rejoinAck).toHaveBeenCalledWith(
            expect.objectContaining({ ok: true, modeId: 'well', yourSeat: 1 })
        );
    });

    it('rejoin after grace expires cleanly fails', () => {
        const socket = createMockSocket('test-5');
        const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
        registerHandlers(io as any, socket as any);

        const createHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'room:create')[1];
        const createAck = vi.fn();
        createHandler({ modeId: 'well' }, createAck);
        const { code, token } = createAck.mock.calls[0][0];

        const disconnectHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'disconnect')[1];
        disconnectHandler();
        expect(rooms.has(code)).toBe(true);

        //  Advance past 60s grace window
        vi.advanceTimersByTime(60001);
        expect(rooms.has(code)).toBe(false);

        //  Attempt rejoin after expiry
        const rejoinHandler = (socket.on as any).mock.calls.find((c: any) => c[0] === 'room:rejoin')[1];
        const rejoinAck = vi.fn();
        rejoinHandler({ code, token }, rejoinAck);

        expect(rejoinAck).toHaveBeenCalledWith(
            expect.objectContaining({ ok: false, reason: 'room-not-found' })
        );
    });
});
