/**
 * URL search-parameter parsers for routes. Hand-written (no schema library in the main bundle): each keeps
 * only values it recognises, so a hand-edited URL can never put the UI into an invalid state.
 */
import {
  GRAPH_DIRECTIONS,
  IDEA_STAGES,
  MAX_GRAPH_DEPTH,
  type GraphDirection,
  type IdeaStage,
} from "@ideaproxima/domain";
import type { LensKey } from "@ideaproxima/domain";
import { isLensKey } from "@/lib/vocabulary";

type Raw = Record<string, unknown>;

const text = (v: unknown, max = 200): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : undefined;

const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | undefined =>
  typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : undefined;

export interface ExploreSearch {
  lens?: LensKey;
  topic?: string;
  stage?: IdeaStage;
  tag?: string;
  q?: string;
}

export const parseExploreSearch = (s: Raw): ExploreSearch => ({
  lens: isLensKey(s.lens) ? s.lens : undefined,
  topic: text(s.topic, 80),
  stage: oneOf(s.stage, IDEA_STAGES),
  tag: text(s.tag, 40),
  q: text(s.q),
});

export interface TopicSearch {
  lens?: LensKey;
}
export const parseTopicSearch = (s: Raw): TopicSearch => ({ lens: isLensKey(s.lens) ? s.lens : undefined });

export interface QuerySearch {
  q?: string;
}
export const parseQuerySearch = (s: Raw): QuerySearch => ({ q: text(s.q) });

export interface ActivitySearch {
  action?: string;
}
export const parseActivitySearch = (s: Raw): ActivitySearch => ({ action: text(s.action, 60) });

export interface RedirectSearch {
  redirect?: string;
}
/** Only same-site paths are accepted as a post-login destination (no open redirects). */
export const parseRedirectSearch = (s: Raw): RedirectSearch => {
  const value = text(s.redirect, 500);
  return { redirect: value && value.startsWith("/") && !value.startsWith("//") ? value : undefined };
};

export interface GraphSearch {
  direction?: GraphDirection;
  depth?: number;
}
export const parseGraphSearch = (s: Raw): GraphSearch => {
  const depth = Number(s.depth);
  return {
    direction: oneOf(s.direction, GRAPH_DIRECTIONS),
    depth: Number.isInteger(depth) && depth >= 1 && depth <= MAX_GRAPH_DEPTH ? depth : undefined,
  };
};
