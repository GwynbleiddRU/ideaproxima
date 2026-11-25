import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { GraphDto } from "@ideaproxima/contracts";
import { RELATION_TYPE_INFO } from "@ideaproxima/domain";
import { isRtl } from "@ideaproxima/i18n/locales";
import { layoutGraph } from "@/lib/graph-layout";
import { cx } from "@/lib/cx";
import { useVocabulary } from "@/lib/vocabulary";
import { activeLocale } from "@/locales/runtime";
import styles from "./RelationGraph.module.scss";

const COL = 290;
const ROW = 88;
const NODE_W = 244;
const NODE_H = 70;
const PAD = 24;
const HEAD = 26;
const LINE_CHARS = 29;

/** A title in at most two lines, broken at words; the second line ends in "…" when the title is longer. */
function wrap(title: string): string[] {
  const lines: string[] = [""];
  for (const word of title.split(/\s+/)) {
    const line = lines.at(-1)!;
    if (!line || line.length + 1 + word.length <= LINE_CHARS)
      lines[lines.length - 1] = line ? `${line} ${word}` : word;
    else if (lines.length < 2) lines.push(word);
    else {
      lines[1] = `${lines[1]!.slice(0, LINE_CHARS - 1).trimEnd()}…`;
      return lines;
    }
  }
  return lines.map((l) => (l.length > LINE_CHARS ? `${l.slice(0, LINE_CHARS - 1)}…` : l));
}

/** A column's name, relative to the focal idea: what it builds on to the left, what builds on it to the right. */
function columnLabel(layer: number): string {
  if (layer === 0) return "This idea";
  if (layer === -1) return "What it needs";
  if (layer === 1) return "What it enables";
  return layer < 0 ? `${-layer} steps back` : `${layer} steps on`;
}

/**
 * The connection map: columns by dependency, read left to right as "needs → this idea → enables". When nothing
 * builds on the idea yet and the view looks downstream, a dashed placeholder says so — an invitation, not a gap.
 */
export function RelationGraph({ graph, showEnables = true }: { graph: GraphDto; showEnables?: boolean }) {
  const vocabulary = useVocabulary();
  const rtl = isRtl(activeLocale());
  const [hover, setHover] = useState<string | null>(null);
  const laid = useMemo(() => layoutGraph(graph), [graph]);
  const { nodes, rows, minLayer } = laid;
  const maxLayer = minLayer + laid.columns - 1;
  const placeholder = showEnables && maxLayer < 1;
  const columns = laid.columns + (placeholder ? 1 : 0);
  const x = (layer: number) => PAD + (layer - minLayer) * COL;
  const position = new Map(nodes.map((n) => [n.id, { x: x(n.layer), y: PAD + HEAD + n.row * ROW }]));
  const focusY = position.get(graph.focusId)?.y ?? PAD + HEAD;
  const width = PAD * 2 + (columns - 1) * COL + NODE_W;
  const height = PAD * 2 + HEAD + (rows - 1) * ROW + NODE_H;
  const nodeX = (left: number) => (rtl ? width - left - NODE_W : left);
  const mirroredEdges = rtl ? `translate(${width} 0) scale(-1 1)` : undefined;

  return (
    <figure
      className={styles.scroller}
      aria-label={`Connection map: ${nodes.length} ideas, ${graph.edges.length} connections`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={styles.svg}>
        {Array.from({ length: columns }, (_, i) => minLayer + i).map((layer) => (
          <text key={layer} x={nodeX(x(layer)) + NODE_W / 2} y={PAD + 8} className={styles.columnLabel}>
            {columnLabel(layer)}
          </text>
        ))}
        <g transform={mirroredEdges}>
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
                <title>{`${vocabulary.text(`relationTypes.${edge.type}.label`, info.label)}: ${vocabulary.text(`relationTypes.${edge.type}.description`, info.description)}`}</title>
              </path>
            );
          })}
        </g>
        {nodes.map((node) => {
          const p = position.get(node.id)!;
          const focus = node.id === graph.focusId;
          return (
            <Link key={node.id} to="/ideas/$idea/connections" params={{ idea: node.slug }}>
              <g
                className={cx(styles.node, focus && styles.focus)}
                transform={`translate(${nodeX(p.x)} ${p.y})`}
                onMouseEnter={() => setHover(node.id)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{node.title}</title>
                <rect width={NODE_W} height={NODE_H} rx={10} />
                {wrap(node.title).map((line, i) => (
                  <text key={i} x={14} y={24 + i * 18} className={styles.nodeTitle}>
                    {line}
                  </text>
                ))}
                <text x={14} y={NODE_H - 12} className={styles.nodeMeta}>
                  {vocabulary.stage(node.stage).label}
                  {node.topics[0] ? ` · ${node.topics[0]}` : ""}
                </text>
              </g>
            </Link>
          );
        })}
        {placeholder && (
          <g transform={`translate(${nodeX(x(1))} ${focusY})`} className={styles.ghost}>
            <path
              d={rtl ? `M${COL} ${NODE_H / 2}H${NODE_W}` : `M${-COL + NODE_W} ${NODE_H / 2}H0`}
              className={cx(styles.edge, styles.lateral)}
            />
            <rect width={NODE_W} height={NODE_H} rx={10} />
            <text x={14} y={30} className={styles.nodeMeta}>
              Nothing recorded builds on it yet.
            </text>
            <text x={14} y={48} className={styles.nodeMeta}>
              Know an idea it would enable? Connect it.
            </text>
          </g>
        )}
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
