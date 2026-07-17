interface OpponentSelectProps
{
    onSelect: (opponentType: 'human' | 'ai') => void;
}

export function OpponentSelect ({ onSelect }: OpponentSelectProps)
{
    return (
        <div id="menu-layer">
            <div id="menu-box">
                <h1 className="menu-title">Pebble Trap</h1>
                <div className="menu-modes">
                    <button type="button" className="menu-mode-button" onClick={() => onSelect('ai')}>
                        Solo (vs AI)
                    </button>
                    <button type="button" className="menu-mode-button" onClick={() => onSelect('human')}>
                        Hotseat (2 Players)
                    </button>
                </div>
            </div>
        </div>
    );
}
