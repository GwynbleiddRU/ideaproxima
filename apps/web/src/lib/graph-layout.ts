import type { GraphDto } from "@ideaproxima/contracts";
import { BUILDS_ON_RELATION_TYPES, type RelationType } from "@ideaproxima/domain";

const BUILDS_ON = new Set<RelationType>(BUILDS_ON_RELATION_TYPES);

export type LaidOutNode = GraphDto["nodes"][number] & { layer: number; row: number };

/**
 * Lays the graph out in columns by dependency: what the focal idea builds on to the left, what builds on it to
 * the right, alternatives and complements beside their neighbour. Deterministic (no physics), so the same
 * graph always looks the same and reads left-to-right as "requires → this → enables".
 */
export function layoutGraph(graph: GraphDto): {
  nodes: LaidOutNode[];
  columns: number;
  rows: number;
  minLayer: number;
} {
  const layer = new Map<string, number>([[graph.focusId, 0]]);
  const queue = [graph.focusId];
  while (queue.length) {
    const id = queue.shift()!;
    const here = layer.get(id)!;
    for (const edge of graph.edges) {
      if (edge.from !== id && edge.to !== id) continue;
      const other = edge.from === id ? edge.to : edge.from;
      if (layer.has(other)) continue;
      // "from builds on to": `to` is a foundation (left), `from` builds further (right).
      const shift = BUILDS_ON.has(edge.type) ? (edge.from === id ? -1 : 1) : 0;
      layer.set(other, here + shift);
      queue.push(other);
    }
  }
  const layers = [...layer.values()];
  const minLayer = Math.min(0, ...layers);
  const rowsPerLayer = new Map<number, number>();
  const nodes = graph.nodes
    .filter((n) => layer.has(n.id))
    .sort((a, b) => (a.id === graph.focusId ? -1 : b.id === graph.focusId ? 1 : a.distance - b.distance))
    .map((n) => {
      const l = layer.get(n.id)!;
      const row = rowsPerLayer.get(l) ?? 0;
      rowsPerLayer.set(l, row + 1);
      return { ...n, layer: l, row };
    });
  return {
    nodes,
    columns: Math.max(...layers) - minLayer + 1,
    rows: Math.max(1, ...rowsPerLayer.values()),
    minLayer,
  };
}
