import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class BoardScene extends Scene
{
    constructor ()
    {
        super('BoardScene');
    }

    create ()
    {
        this.add.text(360, 640, 'Pebble Trap\n(board arrives in phase 3)', {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        EventBus.emit('current-scene-ready', this);
    }
}
