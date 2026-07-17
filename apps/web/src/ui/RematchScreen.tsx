//  Phase 9: Rematch screen
//  Players see mutual accept UI and can confirm next game
//  TODO: Wire 'rematch:offer', 'rematch:accept', 'rematch:reject' events
//  TODO: On both accept, call scene.restart with flipped seats or new seed

interface RematchScreenProps {
    winner: 1 | 2 | null;
    onAccept: () => void;
    onReject: () => void;
}

export function RematchScreen({ winner, onAccept, onReject }: RematchScreenProps) {
    return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <h2>{winner ? `Player ${winner} wins!` : 'Game Over'}</h2>
            <p>Play again?</p>
            <button onClick={onAccept}>Accept</button>
            <button onClick={onReject}>Decline</button>
        </div>
    );
}
