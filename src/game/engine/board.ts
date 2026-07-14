import type { BoardDef, VertexId } from './types';

//  Edges are the consecutive pairs of each line, deduplicated (unordered).
export function edgesFromLines(lines: VertexId[][]): [VertexId, VertexId][] {
    const seen = new Set<string>();
    const edges: [VertexId, VertexId][] = [];
    for (const line of lines) {
        for (let i = 0; i + 1 < line.length; i++) {
            const key = [line[i], line[i + 1]].sort().join('-');
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([line[i], line[i + 1]]);
            }
        }
    }
    return edges;
}

export function adjacency(board: BoardDef): Record<VertexId, VertexId[]> {
    const adj: Record<VertexId, VertexId[]> = {};
    for (const v of board.vertices) {
        adj[v.id] = [];
    }
    for (const [a, b] of edgesFromLines(board.lines)) {
        adj[a].push(b);
        adj[b].push(a);
    }
    return adj;
}
