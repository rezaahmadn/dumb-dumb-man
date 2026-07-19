import { useState } from 'react';
import { getSocket, initSocket } from '../net/socket';
import { probeServerHealth } from '../net/healthProbe';
import type { CreateAck, JoinAck } from '@pebble/protocol';
import type { GameState, PlayerId } from '@pebble/engine';

interface OnlineLobbyProps {
    modeId: string;
    onCreated: (code: string, token: string) => void;
    onJoined: (code: string, token: string, yourSeat: PlayerId, state: GameState) => void;
    onBack: () => void;
}

export function OnlineLobby({ modeId, onCreated, onJoined, onBack }: OnlineLobbyProps) {
    const [roomCode, setRoomCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

    const ensureSocket = async () => {
        try {
            const healthy = await probeServerHealth(serverUrl);
            if (!healthy) {
                setError('Server unreachable');
                return null;
            }
            try {
                return getSocket();
            } catch {
                return initSocket(serverUrl);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed');
            return null;
        }
    };

    const createRoom = async () => {
        setLoading(true);
        setError('');
        const sock = await ensureSocket();
        if (!sock) {
            setLoading(false);
            return;
        }
        sock.emit('room:create', { modeId }, (result: CreateAck) => {
            setLoading(false);
            if (result.ok) {
                onCreated(result.code, result.token);
            } else {
                setError(`Create failed: ${result.reason}`);
            }
        });
    };

    const joinRoom = async () => {
        if (!roomCode.trim()) {
            setError('Enter a room code');
            return;
        }
        setLoading(true);
        setError('');
        const sock = await ensureSocket();
        if (!sock) {
            setLoading(false);
            return;
        }
        sock.emit('room:join', { code: roomCode.toUpperCase() as any }, (result: JoinAck) => {
            setLoading(false);
            if (result.ok) {
                onJoined(result.code, result.token, result.yourSeat, result.state);
            } else {
                setError(`Join failed: ${result.reason}`);
            }
        });
    };

    return (
        <div id="menu-layer">
            <div id="menu-box">
                <h1 className="menu-title">Online</h1>
                <div className="online-panel">
                    <button className="menu-mode-button" onClick={createRoom} disabled={loading}>
                        {loading ? 'Creating…' : 'Create Room'}
                    </button>
                    <div className="online-divider"><span>or</span></div>
                    <div className="online-join">
                        <input
                            className="online-input"
                            type="text"
                            placeholder="Enter room code"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            disabled={loading}
                            maxLength={4}
                        />
                        <button className="menu-mode-button" onClick={joinRoom} disabled={loading}>
                            {loading ? 'Joining…' : 'Join Room'}
                        </button>
                    </div>
                    {error && <p className="online-error">{error}</p>}
                </div>
                <button className="online-back" onClick={onBack}>← Back</button>
            </div>
        </div>
    );
}
