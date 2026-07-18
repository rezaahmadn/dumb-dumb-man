import { useServerAvailable } from '../net/useServerAvailable';

interface OpponentSelectProps
{
    onSelect: (opponentType: 'human' | 'ai') => void;
    onSelectOnline: () => void;
}

export function OpponentSelect ({ onSelect, onSelectOnline }: OpponentSelectProps)
{
    const serverStatus = useServerAvailable();

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
                    {(serverStatus === 'probing' || serverStatus === 'up') && (
                        <button
                            type="button"
                            className="menu-mode-button"
                            onClick={onSelectOnline}
                            disabled={serverStatus !== 'up'}
                        >
                            Online
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
