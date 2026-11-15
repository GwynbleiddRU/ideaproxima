import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { GraphDto } from "@ideaproxima/contracts";
import { IDEA_STAGE_INFO, RELATION_TYPE_INFO } from "@ideaproxima/domain";
import { layoutGraph } from "@/lib/graph-layout";
import { cx } from "@/lib/cx";
import styles from "./RelationGraph.module.scss";

const COL = 280;
const ROW = 76;
const NODE_W = 236;
const NODE_H = 52;
const PAD = 24;

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function RelationGraph({ graph }: { graph: GraphDto }) {
  const [hover, setHover] = useState<string | null>(null);
  const { nodes, columns, rows, minLayer } = useMemo(() => layoutGraph(graph), [graph]);
  const position = new Map(
    nodes.map((n) => [n.id, { x: PAD + (n.layer - minLayer) * COL, y: PAD + n.row * ROW }]),
  );
  const width = PAD * 2 + (columns - 1) * COL + NODE_W;
  const height = PAD * 2 + (rows - 1) * ROW + NODE_H;

  return (
    <figure
      className={styles.scroller}
      aria-label={`Connection map: ${nodes.length} ideas, ${graph.edges.length} connections`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={styles.svg}>
        {graph.edges.map((edge) => {
          const a = position.get(edge.from);
          const b = position.get(edge.to);
          if (!a || !b) return null;
          const info = RELATION_TYPE_INFO[edge.type];
          const [left, right] = a.x <= b.x ? [a, b] : [b, a];
          const sameColumn = left.x === right.x;
          const path = sameColumn
            ? `M${left.x} ${left.y + NODE_H / 2} C${left.x - 40} ${left.y + NODE_H / 2}, ${right.x - 40} ${right.y + NODE_H / 2}, ${right.x} ${right.y + NODE_H / 2}`
            : `M${left.x + NODE_W} ${left.y + NODE_H / 2} C${left.x + NODE_W + 40} ${left.y + NODE_H / 2}, ${right.x - 40} ${right.y + NODE_H / 2}, ${right.x} ${right.y + NODE_H / 2}`;
          const active = hover === edge.from || hover === edge.to;
          return (
            <path
              key={edge.id}
              d={path}
              className={cx(
                styles.edge,
                !info.buildsOn && styles.lateral,
                edge.type === "conflicts_with" && styles.conflict,
                active && styles.edgeActive,
              )}
            >
              <title>{`${info.label}: ${info.description}`}</title>
            </path>
          );
        })}
        {nodes.map((node) => {
          const p = position.get(node.id)!;
          const focus = node.id === graph.focusId;
          return (
            <Link key={node.id} to="/ideas/$idea/connections" params={{ idea: node.slug }}>
              <g
                className={cx(styles.node, focus && styles.focus)}
                transform={`translate(${p.x} ${p.y})`}
                onMouseEnter={() => setHover(node.id)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{node.title}</title>
                <rect width={NODE_W} height={NODE_H} rx={10} />
                <text x={12} y={21} className={styles.nodeTitle}>
                  {truncate(node.title, 27)}
                </text>
                <text x={12} y={39} className={styles.nodeMeta}>
                  {IDEA_STAGE_INFO[node.stage].label}
                  {node.topics[0] ? ` · ${node.topics[0]}` : ""}
                </text>
              </g>
            </Link>
          );
        })}
      </svg>
      <p className={styles.legend}>
        <span>
          <i className={styles.legendSolid} /> builds on (requires, applies, extends, derived from)
        </span>
        <span>
          <i className={styles.legendDashed} /> alternative or complement
        </span>
        <span>
          <i className={styles.legendConflict} /> conflicts with
        </span>
      </p>
    </figure>
  );
}
