//  Phase 10: Rejoin after grace period
//  TODO: Validate session token exists
//  TODO: Call room:rejoin, restore game state via hydrateState

interface RejoinScreenProps {
    onRejoin: () => void;
    onNewGame: () => void;
}

export function RejoinScreen({ onRejoin, onNewGame }: RejoinScreenProps) {
    return (
        <div id="menu-layer">
            <div id="menu-box">
                <h1 className="menu-title">Connection Lost</h1>
                <div className="online-panel">
                    <p className="online-subtitle">Resume your game within 60 seconds</p>
                    <button className="menu-mode-button" onClick={onRejoin}>Rejoin</button>
                    <button className="online-back" onClick={onNewGame}>New Game</button>
                </div>
            </div>
        </div>
    );
}
