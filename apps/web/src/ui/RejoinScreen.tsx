//  Phase 10: Rejoin after grace period
//  TODO: Validate session token exists
//  TODO: Call room:rejoin, restore game state via hydrateState

interface RejoinScreenProps {
    onRejoin: () => void;
    onNewGame: () => void;
}

export function RejoinScreen({ onRejoin, onNewGame }: RejoinScreenProps) {
    return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <h2>Connection Lost</h2>
            <p>Resume game within 60 seconds</p>
            <button onClick={onRejoin}>Rejoin</button>
            <button onClick={onNewGame}>New Game</button>
        </div>
    );
}
