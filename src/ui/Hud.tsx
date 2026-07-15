import { PLAYER_COLOR_CSS, PLAYER_NAME } from '../game/render/theme';
import type { HudSnapshot } from '../game/scenes/BoardScene';
import type { PlayerId } from '../game/engine/types';

interface HudProps
{
    snapshot: HudSnapshot | null;
    onRestart: () => void;
    onMenu: () => void;
    aiPlayer: PlayerId | null;
}

function turnText (snapshot: HudSnapshot, aiPlayer: PlayerId | null): string
{
    const { game, pebblesPerPlayer } = snapshot;
    const name = PLAYER_NAME[game.current];
    if (aiPlayer !== null && game.current === aiPlayer)
    {
        return `${name} is thinking...`;
    }
    if (game.phase === 'placement')
    {
        const n = game.placed[game.current] + 1;
        return `${name}: place pebble (${n}/${pebblesPerPlayer})`;
    }
    return `${name}: move a pebble`;
}

export function Hud ({ snapshot, onRestart, onMenu, aiPlayer }: HudProps)
{
    if (!snapshot)
    {
        return null;
    }

    const { game } = snapshot;
    const isOver = game.phase === 'gameover';

    return (
        <div id="hud-layer">
            <div id="hud-box">
                <button type="button" className="hud-menu-button" onClick={onMenu}>
                    Menu
                </button>
                {!isOver && (
                    <div className="hud-turn" style={{ color: PLAYER_COLOR_CSS[game.current] }}>
                        {turnText(snapshot, aiPlayer)}
                    </div>
                )}
                {isOver && (
                    <div className="hud-overlay">
                        <div
                            className="hud-overlay-text"
                            style={game.winner !== null ? { color: PLAYER_COLOR_CSS[game.winner] } : undefined}
                        >
                            {game.winner !== null ? `${PLAYER_NAME[game.winner]} wins!` : 'Draw!'}
                        </div>
                        <div className="hud-overlay-actions">
                            <button type="button" className="hud-button" onClick={onRestart}>
                                Play again
                            </button>
                            <button type="button" className="hud-button hud-button-secondary" onClick={onMenu}>
                                Menu
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
