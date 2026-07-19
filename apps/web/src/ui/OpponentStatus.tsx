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
        return <div className="net-banner net-banner-top net-banner-error">Game ended — opponent left</div>;
    }
    if (!connected) {
        return <div className="net-banner net-banner-top net-banner-warn">Opponent disconnected — waiting to reconnect…</div>;
    }
    return null;
}
