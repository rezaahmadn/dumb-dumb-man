import { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    create ()
    {
        const modeId = (this.registry.get('modeId') as string | undefined) ?? 'well';
        this.scene.start('BoardScene', { modeId });
    }
}
