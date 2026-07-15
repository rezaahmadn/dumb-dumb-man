import { useEffect, useRef, useState } from 'react';
import { EventBus } from './game/EventBus';
import type { BoardScene, HudSnapshot } from './game/scenes/BoardScene';
import type { IRefPhaserGame } from './PhaserGame';
import { PhaserGame } from './PhaserGame';
import { Hud } from './ui/Hud';

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null);

    const currentScene = (scene: Phaser.Scene) =>
    {
        const board = scene as BoardScene;
        setSnapshot(board.getSnapshot());
    };

    useEffect(() =>
    {
        EventBus.on('game-state-changed', setSnapshot);
        return () =>
        {
            EventBus.removeListener('game-state-changed');
        };
    }, []);

    const restart = () =>
    {
        const board = phaserRef.current?.scene as BoardScene | undefined;
        board?.restartGame();
    };

    return (
        <>
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            <Hud snapshot={snapshot} onRestart={restart} />
        </>
    );
}

export default App
