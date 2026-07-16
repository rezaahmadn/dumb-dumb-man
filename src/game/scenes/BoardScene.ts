import { Geom, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { chooseMove } from '../engine/ai';
import { applyMove, initialState, legalMoves } from '../engine/rules';
import type { GameState, Move, PlayerId, VertexId } from '../engine/types';
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
    opponentType?: 'human' | 'ai';
}

//  Human is always player 1 (red), AI always player 2 (blue) — matches
//  initialState's existing default (player 1 moves first) and the PRD
//  Decisions Log. Never derived dynamically; v1 has exactly one AI seat.
const AI_PLAYER: PlayerId = 2;

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
    private opponentType: 'human' | 'ai' = 'human';

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
        this.opponentType = data.opponentType ?? 'human';
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
        this.refreshDraggable();
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
            //  Direct property set — setInteractive({ dropZone: true }) is a
            //  silent no-op on an object that already has .input (verified
            //  against Phaser 4.0.0 source: the config-object's dropZone key
            //  is read only inside setHitArea(), which enable() skips
            //  whenever .input already exists — exactly this case, since
            //  setInteractive() was just called above). This does NOT
            //  disable ordinary tap behavior — dropZone is additive.
            if (hit.input)
            {
                hit.input.dropZone = true;
            }
            hit.setData('vertexId', v.id);
            hit.on('pointerdown', () => this.onVertexTap(v.id));
        }
    }

    private onVertexTap (id: VertexId)
    {
        if (this.state.phase === 'gameover')
        {
            return;
        }

        if (this.opponentType === 'ai' && this.state.current === AI_PLAYER)
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

    //  Wired once per pebble, at creation. Drag is a second INPUT METHOD
    //  feeding the same onVertexTap state machine a tap already drives —
    //  never a second decision system.
    //
    //  didDrag distinguishes a real cancelled drag from a plain tap: dragend
    //  fires on EVERY press/release pair (including zero-movement taps, with
    //  dropped:false there too — verified against Phaser 4.0.0 source,
    //  InputPlugin.js processDragUpEvent), so dropped alone can't tell them
    //  apart. didDrag is set ONLY inside 'drag', which fires ONLY after real
    //  pointer movement.
    private wirePebbleEvents (pebble: Phaser.GameObjects.Arc)
    {
        let didDrag = false;

        pebble.on('pointerdown', () =>
        {
            didDrag = false;
            this.onVertexTap(pebble.getData('vertexId'));
        });

        pebble.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) =>
        {
            didDrag = true;
            pebble.x = dragX;
            pebble.y = dragY;
        });

        pebble.on('drop', (_pointer: Phaser.Input.Pointer, dropZone: Phaser.GameObjects.GameObject) =>
        {
            const originVertexId = pebble.getData('vertexId');
            const targetVertexId = dropZone.getData('vertexId');
            this.onVertexTap(targetVertexId);
            //  onVertexTap only relocates the pebble in pebbleObjects on a
            //  LEGAL move; if it's still registered at its own origin,
            //  nothing moved (illegal target) — snap the VISUAL position
            //  back. syncPebbles' own tween already handles the legal-move
            //  case, so no `else`.
            if (this.pebbleObjects[originVertexId] === pebble)
            {
                this.snapPebbleToVertex(pebble, originVertexId);
            }
        });

        pebble.on('dragend', (_pointer: Phaser.Input.Pointer, _dragX: number, _dragY: number, dropped: boolean) =>
        {
            //  Fires on EVERY press/release, including a plain tap
            //  (dropped=false there too) — didDrag distinguishes "real drag
            //  released off any zone" from "just a tap". A drop that landed
            //  on SOME zone is fully handled by 'drop' above; don't
            //  double-handle it here.
            if (didDrag && !dropped)
            {
                this.snapPebbleToVertex(pebble, pebble.getData('vertexId'));
                this.clearSelection();
            }
        });
    }

    private snapPebbleToVertex (pebble: Phaser.GameObjects.Arc, vertexId: VertexId)
    {
        const pos = this.vertexPos[vertexId];
        this.tweens.add({
            targets: pebble,
            x: pos.x,
            y: pos.y,
            duration: THEME.moveTweenMs,
            ease: 'Quad.easeInOut'
        });
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
            circle.setData('vertexId', move.to);
            //  Local-space circle centered on the pebble's own origin
            //  (pebbleRadius, pebbleRadius — fixed by the visual size this
            //  Arc was created with) but sized to tapRadius, not
            //  pebbleRadius: a wider touch target than the drawn dot so
            //  pick-up doesn't require pixel-precision, matching the vertex
            //  hit-circles' tap tolerance. Center and radius intentionally
            //  differ here — do not "simplify" back to (r, r, r).
            circle.setInteractive(
                new Geom.Circle(THEME.pebbleRadius, THEME.pebbleRadius, THEME.tapRadius),
                Geom.Circle.Contains
            );
            this.wirePebbleEvents(circle);
            this.pebbleObjects[move.to] = circle;
            return;
        }

        if (move.kind === 'pass') return;

        const circle = this.pebbleObjects[move.from];
        delete this.pebbleObjects[move.from];
        if (!circle)
        {
            return;
        }
        this.pebbleObjects[move.to] = circle;
        //  Pebbles are re-keyed across vertices as they move — this data tag
        //  must be kept current on EVERY relocation, not just creation, or
        //  event handlers reading it via getData() go stale after a
        //  pebble's first move (unlike the hit-circles, which never move
        //  and can safely use a creation-time closure instead).
        circle.setData('vertexId', move.to);
        const dest = this.vertexPos[move.to];
        this.tweens.add({
            targets: circle,
            x: dest.x,
            y: dest.y,
            duration: THEME.moveTweenMs,
            ease: 'Quad.easeInOut'
        });
    }

    //  Full sweep, every state change — never "enable the mover's pebbles",
    //  which would leave the PREVIOUS player's pebbles still draggable.
    //  setDraggable requires the target to already be interactive (throws
    //  otherwise) — safe here because syncPebbles makes every pebble
    //  interactive at creation, unconditionally, before this can ever run
    //  against it.
    private refreshDraggable ()
    {
        for (const key of Object.keys(this.pebbleObjects) as VertexId[])
        {
            const pebble = this.pebbleObjects[key];
            if (!pebble)
            {
                continue;
            }
            const draggable = this.state.phase === 'movement'
                && this.state.board[key] === this.state.current
                && !(this.opponentType === 'ai' && this.state.current === AI_PLAYER);
            this.input.setDraggable(pebble, draggable);
        }
    }

    private applyAndSync (move: Move)
    {
        this.syncPebbles(move);
        this.state = applyMove(this.mode.engine, this.state, move);
        this.refreshDraggable();
        EventBus.emit('game-state-changed', this.getSnapshot());
        this.maybeScheduleAiMove();
    }

    private maybeScheduleAiMove ()
    {
        if (this.opponentType !== 'ai' || this.state.current !== AI_PLAYER || this.state.phase === 'gameover')
        {
            return;
        }
        this.time.delayedCall(THEME.aiMoveDelayMs, () =>
        {
            const move = chooseMove(this.mode.engine, this.state);
            this.applyAndSync(move);
        });
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
