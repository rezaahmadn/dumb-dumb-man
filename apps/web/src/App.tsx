import { useEffect, useRef, useState } from 'react';
import { EventBus } from './game/EventBus';
import type { BoardScene, HudSnapshot } from './game/scenes/BoardScene';
import type { IRefPhaserGame } from './PhaserGame';
import { PhaserGame } from './PhaserGame';
import { Hud } from './ui/Hud';
import { MainMenu } from './ui/MainMenu';
import { OpponentSelect } from './ui/OpponentSelect';
import { OpponentStatus } from './ui/OpponentStatus';
import { OnlineLobby } from './ui/OnlineLobby';
import { RollScreen } from './ui/RollScreen';
import { RejoinScreen } from './ui/RejoinScreen';
import { getSocket, initSocket } from './net/socket';
import type { SessionEnvelope, RejoinAck } from '@pebble/protocol';
import type { PlayerId, GameState } from '@pebble/engine';

type Screen =
  | { kind: 'menu' }
  | { kind: 'opponent-select'; modeId: string }
  | { kind: 'lobby'; modeId: string }
  | { kind: 'roll'; modeId: string; roomCode: string; token: string; yourSeat: PlayerId | null }
  | { kind: 'board'; modeId: string; opponentType: 'human' | 'ai' }
  | { kind: 'board'; modeId: string; opponentType: 'online'; localPlayer: PlayerId; roomCode: string; token: string }
  | { kind: 'rejoining' }
  | { kind: 'rejoin-failed' };

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const pendingHydrateState = useRef<GameState | null>(null);
    const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
    const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null);
    const [opponentConnected, setOpponentConnected] = useState(true);
    const [roomClosedReason, setRoomClosedReason] = useState<string | null>(null);
    const [rematchStatus, setRematchStatus] = useState<'idle' | 'waiting' | 'opponent-wants'>('idle');

    const attemptRejoin = (envelope: SessionEnvelope) => {
        const serverUrl = import.meta.env.VITE_SERVER_URL;
        if (!serverUrl) {
            localStorage.removeItem('pebble-session');
            setScreen({ kind: 'menu' });
            return;
        }

        let socket;
        try {
            socket = getSocket();
        } catch {
            socket = initSocket(serverUrl);
        }

        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            setScreen({ kind: 'rejoin-failed' });
        }, 3000);

        socket.emit('room:rejoin', { code: envelope.code, token: envelope.token }, (ack: RejoinAck) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            if (ack.ok) {
                pendingHydrateState.current = ack.state;
                setScreen({ kind: 'board', modeId: ack.modeId, opponentType: 'online', localPlayer: ack.yourSeat, roomCode: envelope.code, token: envelope.token });
            } else {
                localStorage.removeItem('pebble-session');
                setScreen({ kind: 'menu' });
            }
        });
    };

    useEffect(() => {
        const raw = localStorage.getItem('pebble-session');
        if (!raw) return;
        let envelope: SessionEnvelope;
        try {
            envelope = JSON.parse(raw);
        } catch {
            localStorage.removeItem('pebble-session');
            return;
        }
        setScreen({ kind: 'rejoining' });
        attemptRejoin(envelope);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() =>
    {
        const onSnapshot = (snap: HudSnapshot) => {
            setSnapshot(snap);
            if (snap.game.phase !== 'gameover') setRematchStatus('idle');
        };
        EventBus.on('game-state-changed', onSnapshot);
        return () =>
        {
            EventBus.removeListener('game-state-changed');
        };
    }, []);

    useEffect(() =>
    {
        const onConnection = ({ connected }: { connected: boolean }) => setOpponentConnected(connected);
        const onClosed = ({ reason }: { reason: string }) => setRoomClosedReason(reason);
        const onRematchPending = () => setRematchStatus('opponent-wants');
        EventBus.on('opponent-connection-changed', onConnection);
        EventBus.on('room-closed', onClosed);
        EventBus.on('rematch-pending', onRematchPending);
        return () =>
        {
            EventBus.removeListener('opponent-connection-changed');
            EventBus.removeListener('room-closed');
            EventBus.removeListener('rematch-pending');
        };
    }, []);

    useEffect(() =>
    {
        if (screen.kind !== 'roll' || screen.yourSeat !== null) return;

        const socket = getSocket();
        const handleRollResult = ({ yourSeat, state }: { yourSeat: PlayerId; state: GameState }) =>
        {
            //  The roll decides who moves first, server-side — BoardScene's own
            //  create() always seeds a fresh local initialState() (hardcoded
            //  current: 1) regardless, so without this the freshly-mounted
            //  board silently ignores the roll and shows Red as active even
            //  when the server rolled Blue first. Stash it for currentScene's
            //  existing pendingHydrateState hand-off (same path Phase 10 rejoin
            //  uses) to correct it the moment the scene mounts.
            pendingHydrateState.current = state;
            setScreen(prev => prev.kind === 'roll' ? { ...prev, yourSeat } : prev);
        };

        socket.on('roll:result', handleRollResult);
        return () =>
        {
            socket.off('roll:result', handleRollResult);
        };
    }, [screen.kind]);

    const currentScene = (scene: Phaser.Scene) => {
        const board = scene as BoardScene;
        if (pendingHydrateState.current) {
            const state = pendingHydrateState.current;
            pendingHydrateState.current = null;
            board.hydrateState(state);
            return;
        }
        setSnapshot(board.getSnapshot());
    };

    const startMode = (id: string) =>
    {
        setSnapshot(null);
        setScreen({ kind: 'opponent-select', modeId: id });
    };

    const startOpponent = (type: 'human' | 'ai') =>
    {
        setSnapshot(null);
        if (screen.kind === 'opponent-select') {
            setScreen({ kind: 'board', modeId: screen.modeId, opponentType: type });
        }
    };

    const startOnline = () =>
    {
        setSnapshot(null);
        if (screen.kind === 'opponent-select') {
            setScreen({ kind: 'lobby', modeId: screen.modeId });
        }
    };

    const handleRoomEntered = (code: string, token: string, yourSeat: PlayerId | null = null, state: GameState | null = null) =>
    {
        if (screen.kind !== 'lobby') return;
        const envelope: SessionEnvelope = { token, code, modeId: screen.modeId };
        localStorage.setItem('pebble-session', JSON.stringify(envelope));
        //  A joiner's yourSeat comes from the join ack (see JoinAck's doc
        //  comment), which satisfies the 'roll:result' effect's guard
        //  immediately — that listener, where the rolled state normally gets
        //  stashed for hydration, never attaches for a joiner. Stash it here
        //  instead when the caller already has it (joiner path only; a
        //  creator has no roll yet at this point and passes nothing).
        if (state) pendingHydrateState.current = state;
        setScreen({ kind: 'roll', modeId: screen.modeId, roomCode: code, token, yourSeat });
    };

    const startOnlineBoard = () =>
    {
        setSnapshot(null);
        setOpponentConnected(true);
        setRoomClosedReason(null);
        setRematchStatus('idle');
        if (screen.kind === 'roll' && screen.yourSeat !== null) {
            setScreen({ kind: 'board', modeId: screen.modeId, opponentType: 'online', localPlayer: screen.yourSeat, roomCode: screen.roomCode, token: screen.token });
        }
    };

    const toMenu = () =>
    {
        setSnapshot(null);
        setScreen({ kind: 'menu' });
    };

    const restart = () =>
    {
        if (screen.kind === 'board' && screen.opponentType === 'online') {
            getSocket().emit('rematch:accept');
            setRematchStatus('waiting');
            return;
        }
        const board = phaserRef.current?.scene as BoardScene | undefined;
        board?.restartGame();
    };

    const menu = () => {
        if (screen.kind === 'board' && screen.opponentType === 'online') {
            if (!window.confirm('Leave this game?')) return;
            getSocket().emit('room:leave');
            localStorage.removeItem('pebble-session');
        }
        toMenu();
    };

    switch (screen.kind) {
        case 'menu':
            return <MainMenu onSelect={startMode} />;
        case 'opponent-select':
            return <OpponentSelect onSelect={startOpponent} onSelectOnline={startOnline} />;
        case 'lobby':
            return <OnlineLobby modeId={screen.modeId} onCreated={handleRoomEntered} onJoined={handleRoomEntered} onBack={() => setScreen({ kind: 'opponent-select', modeId: screen.modeId })} />;
        case 'roll':
            if (screen.yourSeat === null) {
                return (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <h2>Waiting for opponent…</h2>
                        <p>Room code: {screen.roomCode}</p>
                    </div>
                );
            }
            return <RollScreen yourSeat={screen.yourSeat} onReady={startOnlineBoard} />;
        case 'board':
            if (screen.opponentType === 'online') {
                return (
                    <>
                        <PhaserGame ref={phaserRef} currentActiveScene={currentScene} modeId={screen.modeId} opponentType="online" localPlayer={screen.localPlayer} />
                        <Hud snapshot={snapshot} onRestart={restart} onMenu={menu} aiPlayer={null} />
                        <OpponentStatus connected={opponentConnected} gameClosed={roomClosedReason !== null} />
                        {rematchStatus === 'waiting' && (
                            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#333', padding: '10px', color: 'white', textAlign: 'center' }}>
                                Waiting for opponent to accept rematch…
                            </div>
                        )}
                        {rematchStatus === 'opponent-wants' && (
                            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#333', padding: '10px', color: 'white', textAlign: 'center' }}>
                                Opponent wants a rematch — click "Play again" to accept!
                            </div>
                        )}
                    </>
                );
            }
            return (
                <>
                    <PhaserGame ref={phaserRef} currentActiveScene={currentScene} modeId={screen.modeId} opponentType={screen.opponentType} />
                    <Hud snapshot={snapshot} onRestart={restart} onMenu={menu} aiPlayer={screen.opponentType === 'ai' ? 2 : null} />
                </>
            );
        case 'rejoining':
            return (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h2>Reconnecting…</h2>
                </div>
            );
        case 'rejoin-failed':
            return (
                <RejoinScreen
                    onRejoin={() => {
                        const raw = localStorage.getItem('pebble-session');
                        if (!raw) { setScreen({ kind: 'menu' }); return; }
                        try {
                            const envelope: SessionEnvelope = JSON.parse(raw);
                            setScreen({ kind: 'rejoining' });
                            attemptRejoin(envelope);
                        } catch {
                            localStorage.removeItem('pebble-session');
                            setScreen({ kind: 'menu' });
                        }
                    }}
                    onNewGame={() => {
                        localStorage.removeItem('pebble-session');
                        setScreen({ kind: 'menu' });
                    }}
                />
            );
    }
}

export default App
