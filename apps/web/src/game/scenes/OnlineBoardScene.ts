import type { GameState, Move } from '@pebble/engine';
import type { MoveAck, RejoinAck, SessionEnvelope } from '@pebble/protocol';
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

    //  socket.io-client reconnects the transport on its own (reconnection:true
    //  in net/socket.ts) after a drop, but the SERVER only knows a socket as a
    //  room member via socket.join(code) — reconnecting issues a brand-new
    //  socket.id that was never joined to the room. Left alone, any
    //  'game:update' broadcast sent while we were offline is lost for good
    //  (socket.io does not queue events for a disconnected socket), and the
    //  reconnected socket can't even send moves afterwards (server's 'move'
    //  handler resolves the room via socket.rooms, which is now empty) —
    //  exactly the "stuck until I refresh" report, since a manual reload was
    //  the only thing that re-ran the localStorage-driven room:rejoin flow.
    //  Manager-level 'reconnect' (not Socket-level 'connect', which also
    //  fires on the very first connect) lets us redo that same rejoin
    //  silently the instant the transport comes back.
    private resyncAfterReconnect (): void
    {
        const raw = localStorage.getItem('pebble-session');
        if (!raw) return;
        let envelope: SessionEnvelope;
        try {
            envelope = JSON.parse(raw);
        } catch {
            return;
        }
        getSocket().emit('room:rejoin', { code: envelope.code, token: envelope.token }, (ack: RejoinAck) => {
            if (ack.ok) {
                //  The rejoin's state is authoritative as of right now — any
                //  outstanding awaitingEcho lock from a move whose ack was
                //  lost in the drop is moot once we've hydrated past it.
                this.awaitingEcho = false;
                this.hydrateState(ack.state);
            }
        });
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
        socket.io.on('reconnect', () => this.resyncAfterReconnect());
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
        socket.io.off('reconnect');
    }
}
