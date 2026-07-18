//  Phase 11: Opponent connection status overlay
//  TODO: Listen for opponent:disconnected / :reconnected events
//  TODO: Show banner "Opponent disconnected - waiting to rejoin"
//  TODO: On room:closed, show "Game ended - opponent left"

interface OpponentStatusProps {
    connected: boolean;
    gameClosed: boolean;
}

export function OpponentStatus({ connected, gameClosed }: OpponentStatusProps) {
    if (gameClosed) {
        return <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'red', padding: '10px', color: 'white' }}>Game ended - opponent left</div>;
    }
    if (!connected) {
        return <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'orange', padding: '10px', color: 'white' }}>Opponent disconnected - waiting...</div>;
    }
    return null;
}
