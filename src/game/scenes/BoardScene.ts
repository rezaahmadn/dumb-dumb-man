import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import type { VertexId } from '../engine/types';
import { MODES } from '../modes/registry';
import type { GameModeDef } from '../modes/types';
import { THEME } from '../render/theme';

interface BoardSceneData
{
    modeId?: string;
}

//  Everything drawn here comes from GameModeDef data (strokes + vertex
//  coords). No board-specific constants may appear in this file — that is
//  the PRD phase-3 success signal.
const degToRad = (deg: number) => (deg * Math.PI) / 180;

export class BoardScene extends Scene
{
    private mode!: GameModeDef;

    constructor ()
    {
        super('BoardScene');
    }

    init (data: BoardSceneData)
    {
        const modeId = data.modeId ?? 'well';
        const mode = MODES[modeId];
        if (!mode)
        {
            throw new Error(`unknown mode: ${modeId}`);
        }
        this.mode = mode;
    }

    create ()
    {
        this.drawBoard();

        EventBus.emit('current-scene-ready', this);
    }

    private drawBoard ()
    {
        const g = this.add.graphics();
        const pos: Record<VertexId, { x: number; y: number }> = {};
        for (const v of this.mode.engine.board.vertices)
        {
            pos[v.id] = { x: v.x, y: v.y };
        }

        g.lineStyle(THEME.boardLineWidth, THEME.boardLine);
        for (const stroke of this.mode.boardStrokes)
        {
            if (stroke.kind === 'segment')
            {
                const a = pos[stroke.from];
                const b = pos[stroke.to];
                g.lineBetween(a.x, a.y, b.x, b.y);
            }
            else
            {
                g.beginPath();
                g.arc(
                    stroke.cx,
                    stroke.cy,
                    stroke.radius,
                    degToRad(stroke.startDeg),
                    degToRad(stroke.endDeg),
                    false
                );
                g.strokePath();
            }
        }

        for (const v of this.mode.engine.board.vertices)
        {
            g.fillStyle(THEME.vertexDot);
            g.fillCircle(v.x, v.y, THEME.vertexRadius);
        }
    }
}
