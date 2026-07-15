import { AUTO, Game, Scale } from 'phaser';
import { Boot } from './scenes/Boot';
import { BoardScene } from './scenes/BoardScene';

//  Design resolution is locked to mobile portrait (9:16).
//  Scale.FIT preserves the aspect ratio on every window shape,
//  so desktop browsers get a centered pillar, never full width.
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 720,
    height: 1280,
    parent: 'game-container',
    backgroundColor: '#111418',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        Boot,
        BoardScene
    ]
};

const StartGame = (parent: string, modeId = 'well') => {

    const game = new Game({ ...config, parent });
    game.registry.set('modeId', modeId);
    return game;

}

export default StartGame;
