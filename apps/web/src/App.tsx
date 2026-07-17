import { useEffect, useRef, useState } from 'react';
import { EventBus } from './game/EventBus';
import type { BoardScene, HudSnapshot } from './game/scenes/BoardScene';
import type { IRefPhaserGame } from './PhaserGame';
import { PhaserGame } from './PhaserGame';
import { Hud } from './ui/Hud';
import { MainMenu } from './ui/MainMenu';
import { OpponentSelect } from './ui/OpponentSelect';

type Screen =
  | { kind: 'menu' }
  | { kind: 'opponent-select'; modeId: string }
  | { kind: 'board'; modeId: string; opponentType: 'human' | 'ai' };

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
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
        setScreen({ kind: 'opponent-select', modeId: id });
    };

    const startOpponent = (type: 'human' | 'ai') =>
    {
        setSnapshot(null);
        if (screen.kind === 'opponent-select') {
            setScreen({ kind: 'board', modeId: screen.modeId, opponentType: type });
        }
    };

    const toMenu = () =>
    {
        setSnapshot(null);
        setScreen({ kind: 'menu' });
    };

    const restart = () =>
    {
        const board = phaserRef.current?.scene as BoardScene | undefined;
        board?.restartGame();
    };

    switch (screen.kind) {
        case 'menu':
            return <MainMenu onSelect={startMode} />;
        case 'opponent-select':
            return <OpponentSelect onSelect={startOpponent} />;
        case 'board':
            return (
                <>
                    <PhaserGame ref={phaserRef} currentActiveScene={currentScene} modeId={screen.modeId} opponentType={screen.opponentType} />
                    <Hud snapshot={snapshot} onRestart={restart} onMenu={toMenu} aiPlayer={screen.opponentType === 'ai' ? 2 : null} />
                </>
            );
    }
}

export default App
