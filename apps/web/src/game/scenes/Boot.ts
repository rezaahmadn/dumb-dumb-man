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
        const opponentType = (this.registry.get('opponentType') as 'human' | 'ai' | undefined) ?? 'human';
        this.scene.start('BoardScene', { modeId, opponentType });
    }
}
