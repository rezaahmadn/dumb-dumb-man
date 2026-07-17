import type { PlayerId } from '@pebble/engine';

interface RollScreenProps {
    yourSeat: PlayerId;
    onReady: () => void;
}

export function RollScreen({ yourSeat, onReady }: RollScreenProps) {
    const color = yourSeat === 1 ? 'Red' : 'Blue';
    return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2>Room Joined</h2>
            <p>You are: <strong>{color}</strong></p>
            <button onClick={onReady}>Start Game</button>
        </div>
    );
}
