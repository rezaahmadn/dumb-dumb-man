import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@pebble/protocol';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function initSocket(serverUrl: string): Socket<ServerToClientEvents, ClientToServerEvents> {
    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
    });
    return socket;
}

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!socket) throw new Error('Socket not initialized. Call initSocket first.');
    return socket;
}

export function closeSocket(): void {
    socket?.disconnect();
    socket = null;
}
