import { MODES } from '@pebble/engine/modes';
import { useServerAvailable } from '../net/useServerAvailable';

interface OpponentSelectProps
{
    modeId: string;
    onSelect: (opponentType: 'human' | 'ai') => void;
    onSelectOnline: () => void;
}

export function OpponentSelect ({ modeId, onSelect, onSelectOnline }: OpponentSelectProps)
{
    const serverStatus = useServerAvailable();
    const modeName = MODES[modeId as keyof typeof MODES]?.name ?? modeId;

    return (
        <div id="menu-layer">
            <div id="menu-box">
                <h1 className="menu-title">{modeName}</h1>
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
