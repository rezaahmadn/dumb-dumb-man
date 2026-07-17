import type { GameState, Move } from '@pebble/engine';
import { BoardScene } from './BoardScene';
import { getSocket } from '../../net/socket';

export class OnlineBoardScene extends BoardScene {
    public setRoom(code: string, seat: 1 | 2): void {
        void code; void seat;
    }

    //  Overridden to broadcast move via socket instead of local-only applyAndSync
    protected applyAndSync(_move: Move): void {
        const socket = getSocket();
        socket.emit('move', { move: _move }, (ack: any) => {
            if (!ack.ok) {
                console.error('Move rejected:', ack.reason);
            }
        });
    }

    //  Listen for opponent moves and update board
    public attachServerListeners(): void {
        const socket = getSocket();
        socket.on('game:update', ({ state }: { move: Move; state: GameState }) => {
            this.hydrateState(state);
        });
        socket.on('opponent:disconnected', () => {
            console.log('Opponent disconnected');
        });
        socket.on('opponent:reconnected', () => {
            console.log('Opponent reconnected');
        });
    }

    public detachServerListeners(): void {
        const socket = getSocket();
        socket.off('game:update');
        socket.off('opponent:disconnected');
        socket.off('opponent:reconnected');
    }
}
