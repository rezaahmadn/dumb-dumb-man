import { MODES } from '../game/modes/registry';

interface MainMenuProps
{
    onSelect: (modeId: string) => void;
}

export function MainMenu ({ onSelect }: MainMenuProps)
{
    const modes = Object.values(MODES);

    return (
        <div id="menu-layer">
            <div id="menu-box">
                <h1 className="menu-title">Dumb Dumb Man</h1>
                <div className="menu-modes">
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            className="menu-mode-button"
                            onClick={() => onSelect(mode.id)}
                        >
                            {mode.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
