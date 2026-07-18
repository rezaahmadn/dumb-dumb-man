import { Scene } from 'phaser';
import type { PlayerId } from '@pebble/engine';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    create ()
    {
        const modeId = (this.registry.get('modeId') as string | undefined) ?? 'well';
        const opponentType = (this.registry.get('opponentType') as 'human' | 'ai' | 'online' | undefined) ?? 'human';
        if (opponentType === 'online')
        {
            const localPlayer = this.registry.get('localPlayer') as PlayerId | undefined;
            if (localPlayer === undefined)
            {
                throw new Error('Boot: opponentType "online" requires localPlayer in registry');
            }
            this.scene.start('OnlineBoardScene', { modeId, opponentType, localPlayer });
            return;
        }
        this.scene.start('BoardScene', { modeId, opponentType });
    }
}
