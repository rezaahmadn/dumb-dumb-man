import type { GameState, Move } from '@pebble/engine';
import type { MoveAck } from '@pebble/protocol';
import { BoardScene } from './BoardScene';
import { EventBus } from '../EventBus';
import { getSocket } from '../../net/socket';

export class OnlineBoardScene extends BoardScene {
    constructor () { super('OnlineBoardScene'); }

    create (): void
    {
        super.create();
        this.attachServerListeners();
        this.events.once('shutdown', () => this.detachServerListeners());
    }

    //  Sends intent only. Never mutates local state — the server is the only
    //  place applyMove ever runs for this scene. awaitingEcho blocks every
    //  further tap (including a double-tap on the same vertex) until the
    //  server's broadcast arrives via applyServerUpdate, OR the move is
    //  rejected, in which case the ack callback below clears the lock itself
    //  (no broadcast will ever arrive for a rejected attempt).
    protected applyAndSync (move: Move): void
    {
        this.awaitingEcho = true;
        const socket = getSocket();
        socket.emit('move', { move }, (ack: MoveAck) => {
            if (!ack.ok) {
                console.error('Move rejected:', ack.reason);
                this.awaitingEcho = false;
            }
        });
    }

    //  The move-driven server broadcast. Reuses syncPebbles + refreshDraggable
    //  + the game-state-changed emit — the same tail applyAndSync uses for the
    //  local-apply path — so the tween animation and the HUD both update
    //  exactly as they do in hotseat/vs-AI. Does NOT call applyMove: the
    //  server has already computed `state` and it is authoritative; recomputing
    //  it client-side would be redundant at best.
    protected applyServerUpdate ({ move, state }: { move: Move; state: GameState }): void
    {
        this.syncPebbles(move);
        this.state = state;
        this.refreshDraggable();
        EventBus.emit('game-state-changed', this.getSnapshot());
        this.awaitingEcho = false;
    }

    public attachServerListeners (): void
    {
        const socket = getSocket();
        socket.on('game:update', (payload: { move: Move; state: GameState }) => {
            this.applyServerUpdate(payload);
        });
        socket.on('game:hydrate', ({ state }: { state: GameState }) => {
            this.hydrateState(state);
        });
        socket.on('opponent:disconnected', () => { EventBus.emit('opponent-connection-changed', { connected: false }); });
        socket.on('opponent:reconnected', () => { EventBus.emit('opponent-connection-changed', { connected: true }); });
        socket.on('rematch:pending', () => { EventBus.emit('rematch-pending'); });
        socket.on('room:closed', ({ reason }: { reason: string }) => { EventBus.emit('room-closed', { reason }); });
    }

    public detachServerListeners (): void
    {
        const socket = getSocket();
        socket.off('game:update');
        socket.off('game:hydrate');
        socket.off('opponent:disconnected');
        socket.off('opponent:reconnected');
        socket.off('rematch:pending');
        socket.off('room:closed');
    }
}
