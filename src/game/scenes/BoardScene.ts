import { Geom, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { applyMove, initialState, legalMoves } from '../engine/rules';
import type { GameState, Move, VertexId } from '../engine/types';
import { MODES } from '../modes/registry';
import type { GameModeDef } from '../modes/types';
import { THEME } from '../render/theme';

export interface HudSnapshot
{
    game: GameState;
    pebblesPerPlayer: number;
}

interface BoardSceneData
{
    modeId?: string;
}

//  Everything drawn here comes from GameModeDef data (strokes + vertex
//  coords). No board-specific constants may appear in this file — invariant
//  carried over from phase 3.
const degToRad = (deg: number) => (deg * Math.PI) / 180;

export class BoardScene extends Scene
{
    private mode!: GameModeDef;
    private state!: GameState;
    private vertexPos: Record<VertexId, { x: number; y: number }> = {};
    private pebbleObjects: Partial<Record<VertexId, Phaser.GameObjects.Arc>> = {};
    private highlightGraphics!: Phaser.GameObjects.Graphics;
    private selected: VertexId | null = null;
    private legalDestinations: Set<VertexId> = new Set();

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
        this.vertexPos = {};
        for (const v of this.mode.engine.board.vertices)
        {
            this.vertexPos[v.id] = { x: v.x, y: v.y };
        }

        this.drawBoard();
        this.createVertexHitAreas();

        this.highlightGraphics = this.add.graphics();
        this.highlightGraphics.setDepth(2);

        this.pebbleObjects = {};
        this.selected = null;
        this.legalDestinations = new Set();
        this.state = initialState(this.mode.engine, this.mode.id);

        //  NOTE: no 'game-state-changed' emit here on purpose — React seeds
        //  its initial snapshot via getSnapshot() through the scene-ready
        //  callback (see App.tsx), not by racing this event.
        EventBus.emit('current-scene-ready', this);
    }

    public getSnapshot (): HudSnapshot
    {
        return { game: this.state, pebblesPerPlayer: this.mode.engine.pebblesPerPlayer };
    }

    public restartGame ()
    {
        for (const key of Object.keys(this.pebbleObjects) as VertexId[])
        {
            this.pebbleObjects[key]?.destroy();
        }
        this.pebbleObjects = {};
        this.selected = null;
        this.legalDestinations = new Set();
        this.renderHighlights();
        this.state = initialState(this.mode.engine, this.mode.id);
        EventBus.emit('game-state-changed', this.getSnapshot());
    }

    private drawBoard ()
    {
        const g = this.add.graphics();

        g.lineStyle(THEME.boardLineWidth, THEME.boardLine);
        for (const stroke of this.mode.boardStrokes)
        {
            if (stroke.kind === 'segment')
            {
                const a = this.vertexPos[stroke.from];
                const b = this.vertexPos[stroke.to];
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

    private createVertexHitAreas ()
    {
        for (const v of this.mode.engine.board.vertices)
        {
            const hit = this.add.circle(v.x, v.y, THEME.tapRadius, 0xffffff, 0);
            //  Bare setInteractive() fails on non-texture Shape objects, and
            //  hit-area coords are LOCAL (origin at the object's top-left),
            //  not world coords. For a centered-origin circle of radius r,
            //  the correct local hit circle is (r, r, r).
            hit.setInteractive(
                new Geom.Circle(THEME.tapRadius, THEME.tapRadius, THEME.tapRadius),
                Geom.Circle.Contains
            );
            hit.on('pointerdown', () => this.onVertexTap(v.id));
        }
    }

    private onVertexTap (id: VertexId)
    {
        if (this.state.phase === 'gameover')
        {
            return;
        }

        const moves = legalMoves(this.mode.engine, this.state);

        if (this.state.phase === 'placement')
        {
            const legal = moves.some((m) => m.kind === 'place' && m.to === id);
            if (legal)
            {
                this.applyAndSync({ kind: 'place', to: id });
            }
            return;
        }

        if (this.selected !== null)
        {
            const isLegalDest = moves.some(
                (m) => m.kind === 'move' && m.from === this.selected && m.to === id
            );
            if (isLegalDest)
            {
                this.applyAndSync({ kind: 'move', from: this.selected, to: id });
                this.clearSelection();
                return;
            }
        }

        if (this.state.board[id] === this.state.current)
        {
            this.selectVertex(id, moves);
        }
        else
        {
            this.clearSelection();
        }
    }

    private selectVertex (id: VertexId, moves: Move[])
    {
        this.selected = id;
        this.legalDestinations = new Set(
            moves
                .filter((m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.from === id)
                .map((m) => m.to)
        );
        this.renderHighlights();
    }

    private clearSelection ()
    {
        this.selected = null;
        this.legalDestinations = new Set();
        this.renderHighlights();
    }

    //  Must run BEFORE this.state is reassigned in applyAndSync: it reads
    //  this.state.current for the mover's color/identity, and for a 'move'
    //  it looks up the pebble object still sitting at `from`.
    private syncPebbles (move: Move)
    {
        const player = this.state.current;
        if (move.kind === 'place')
        {
            const pos = this.vertexPos[move.to];
            const circle = this.add.circle(pos.x, pos.y, THEME.pebbleRadius, THEME.pebble[player]);
            circle.setDepth(1);
            this.pebbleObjects[move.to] = circle;
            return;
        }

        const circle = this.pebbleObjects[move.from];
        delete this.pebbleObjects[move.from];
        if (!circle)
        {
            return;
        }
        this.pebbleObjects[move.to] = circle;
        const dest = this.vertexPos[move.to];
        this.tweens.add({
            targets: circle,
            x: dest.x,
            y: dest.y,
            duration: THEME.moveTweenMs,
            ease: 'Quad.easeInOut'
        });
    }

    private applyAndSync (move: Move)
    {
        this.syncPebbles(move);
        this.state = applyMove(this.mode.engine, this.state, move);
        EventBus.emit('game-state-changed', this.getSnapshot());
    }

    private renderHighlights ()
    {
        this.highlightGraphics.clear();
        if (this.selected === null)
        {
            return;
        }

        const pos = this.vertexPos[this.selected];
        this.highlightGraphics.lineStyle(4, THEME.highlightColor, 0.9);
        this.highlightGraphics.strokeCircle(pos.x, pos.y, THEME.pebbleRadius + 8);

        this.highlightGraphics.fillStyle(THEME.highlightColor, 0.35);
        for (const dest of this.legalDestinations)
        {
            const d = this.vertexPos[dest];
            this.highlightGraphics.fillCircle(d.x, d.y, THEME.vertexRadius + 6);
        }
    }
}
