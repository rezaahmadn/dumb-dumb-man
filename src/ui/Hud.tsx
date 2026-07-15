import { PLAYER_COLOR_CSS, PLAYER_NAME } from '../game/render/theme';
import type { HudSnapshot } from '../game/scenes/BoardScene';

interface HudProps
{
    snapshot: HudSnapshot | null;
    onRestart: () => void;
}

function turnText (snapshot: HudSnapshot): string
{
    const { game, pebblesPerPlayer } = snapshot;
    const name = PLAYER_NAME[game.current];
    if (game.phase === 'placement')
    {
        const n = game.placed[game.current] + 1;
        return `${name}: place pebble (${n}/${pebblesPerPlayer})`;
    }
    return `${name}: move a pebble`;
}

export function Hud ({ snapshot, onRestart }: HudProps)
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
                {!isOver && (
                    <div className="hud-turn" style={{ color: PLAYER_COLOR_CSS[game.current] }}>
                        {turnText(snapshot)}
                    </div>
                )}
                {isOver && game.winner !== null && (
                    <div className="hud-overlay">
                        <div className="hud-overlay-text" style={{ color: PLAYER_COLOR_CSS[game.winner] }}>
                            {PLAYER_NAME[game.winner]} wins!
                        </div>
                        <button type="button" className="hud-button" onClick={onRestart}>
                            Play again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
