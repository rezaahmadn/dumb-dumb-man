import { useEffect, useRef, useState } from 'react';
import { EventBus } from './game/EventBus';
import type { BoardScene, HudSnapshot } from './game/scenes/BoardScene';
import type { IRefPhaserGame } from './PhaserGame';
import { PhaserGame } from './PhaserGame';
import { Hud } from './ui/Hud';
import { MainMenu } from './ui/MainMenu';

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [modeId, setModeId] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null);

    useEffect(() =>
    {
        EventBus.on('game-state-changed', setSnapshot);
        return () =>
        {
            EventBus.removeListener('game-state-changed');
        };
    }, []);

    const currentScene = (scene: Phaser.Scene) =>
    {
        setSnapshot((scene as BoardScene).getSnapshot());
    };

    const startMode = (id: string) =>
    {
        setSnapshot(null);
        setModeId(id);
    };

    const toMenu = () =>
    {
        setSnapshot(null);
        setModeId(null);
    };

    const restart = () =>
    {
        const board = phaserRef.current?.scene as BoardScene | undefined;
        board?.restartGame();
    };

    if (modeId === null)
    {
        return <MainMenu onSelect={startMode} />;
    }

    return (
        <>
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} modeId={modeId} />
            <Hud snapshot={snapshot} onRestart={restart} onMenu={toMenu} />
        </>
    );
}

export default App
