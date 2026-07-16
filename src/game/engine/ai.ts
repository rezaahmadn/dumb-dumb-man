//  engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/).
import { alignedPlayer, applyMove, legalMoves } from './rules';
import type { EngineConfig, GameState, Move, PlayerId, VertexId } from './types';

export function positionKey(cfg: EngineConfig, s: GameState): string {
    return cfg.board.vertices.map((v) => s.board[v.id] ?? '.').join('') + '|' + s.current;
}

function kCombinations<T>(items: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (items.length < k) return [];
    const [first, ...rest] = items;
    const withFirst = kCombinations(rest, k - 1).map((c) => [first, ...c]);
    const withoutFirst = kCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
}

function allLiveMovementNodes(cfg: EngineConfig): GameState[] {
    const vertices = cfg.board.vertices.map((v) => v.id);
    const k = cfg.pebblesPerPlayer;
    const nodes: GameState[] = [];
    for (const p1 of kCombinations(vertices, k)) {
        const rest = vertices.filter((v) => !p1.includes(v));
        for (const p2 of kCombinations(rest, k)) {
            const board: Record<VertexId, PlayerId | null> = {};
            for (const v of vertices) board[v] = null;
            for (const v of p1) board[v] = 1;
            for (const v of p2) board[v] = 2;
            //  In alignment mode, a board where someone already owns a full
            //  line can never be a real mid-game position — applyMove would
            //  already have ended the game the moment that line was
            //  completed — so exclude it here regardless of whose turn it
            //  is on the synthetic board.
            if ((cfg.win ?? 'trap') === 'alignment' && alignedPlayer(cfg, board) !== null) continue;
            for (const current of [1, 2] as PlayerId[]) {
                const state: GameState = {
                    modeId: '',
                    phase: 'movement',
                    board,
                    current,
                    placed: { 1: k, 2: k },
                    winner: null,
                    history: {}
                };
                if (legalMoves(cfg, state).length > 0) nodes.push(state);
            }
        }
    }
    return nodes;
}

export type Label = 'WIN' | 'LOSS' | 'DRAW';
export type Score = 1 | 0 | -1;

const scoreOfLabel = (l: Label): Score => (l === 'WIN' ? 1 : l === 'LOSS' ? -1 : 0);
const negate = (s: Score): Score => (-s as Score);

export function solveMovementGraph(cfg: EngineConfig): Map<string, Label> {
    const nodes = allLiveMovementNodes(cfg);
    const byKey = new Map(nodes.map((n) => [positionKey(cfg, n), n]));

    //  One-ply outcome per legal move from each node: either an immediate
    //  win (applyMove returned gameover) or a transition to another live
    //  node. Nodes are synthetic (history:{}), and a single hop off an
    //  empty history can never reach cfg.repetitionLimit (needs >=3
    //  recorded occurrences) — so `gameover` here is always a real trap,
    //  never a repetition draw. See PRD "Search-time history".
    const edges = new Map<string, { win: boolean; to?: string }[]>();
    for (const [key, node] of byKey) {
        edges.set(
            key,
            legalMoves(cfg, node).map((m) => {
                const child = applyMove(cfg, node, m);
                return child.phase === 'gameover'
                    ? { win: true }
                    : { win: false, to: positionKey(cfg, child) };
            })
        );
    }

    //  Retrograde/fixpoint labeling — NOT on-stack-DFS-as-draw (see PRD
    //  status footer: that approach is provably incorrect in general and
    //  was replaced after adversarial review).
    const labels = new Map<string, Label>();
    let changed = true;
    while (changed) {
        changed = false;
        for (const key of byKey.keys()) {
            if (labels.has(key)) continue;
            const outs = edges.get(key)!;
            if (outs.some((o) => o.win || (o.to !== undefined && labels.get(o.to) === 'LOSS'))) {
                labels.set(key, 'WIN');
                changed = true;
            } else if (outs.every((o) => !o.win && o.to !== undefined && labels.get(o.to) === 'WIN')) {
                labels.set(key, 'LOSS');
                changed = true;
            }
        }
    }
    for (const key of byKey.keys()) {
        if (!labels.has(key)) labels.set(key, 'DRAW');
    }
    return labels;
}

function valueOfMove(
    cfg: EngineConfig,
    s: GameState,
    m: Move,
    movementLabels: Map<string, Label>
): Score {
    const child = applyMove(cfg, s, m);
    if (child.phase === 'gameover') {
        //  A move can only end the game as an immediate WIN for the mover
        //  or a DRAW — applyMove's trap check fires because the OPPONENT
        //  (next to move) has 0 legal moves, so the mover just trapped
        //  them; it can never make the opponent win on your own move.
        return child.winner === s.current ? 1 : 0;
    }
    if (child.phase === 'movement') {
        return negate(scoreOfLabel(movementLabels.get(positionKey(cfg, child))!));
    }
    //  child.phase === 'placement' — still placing, recurse
    return negate(valuePlacement(cfg, child, movementLabels));
}

function valuePlacement(cfg: EngineConfig, s: GameState, movementLabels: Map<string, Label>): Score {
    const scores = legalMoves(cfg, s).map((m) => valueOfMove(cfg, s, m, movementLabels));
    return Math.max(...scores) as Score;
}

export function chooseMove(cfg: EngineConfig, s: GameState): Move {
    const movementLabels = solveMovementGraph(cfg);
    const moves = legalMoves(cfg, s);
    let best = moves[0];
    let bestScore: Score = -1;
    for (const m of moves) {
        const v = valueOfMove(cfg, s, m, movementLabels);
        if (v > bestScore) {
            bestScore = v;
            best = m;
        }
    }
    return best;
}
