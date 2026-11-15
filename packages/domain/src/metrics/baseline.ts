/**
 * BASELINE DERIVED METRICS — "baseline-v0".
 *
 * These functions turn raw observations (ratings, stances, sections) into derived values. They are:
 *  - deterministic and pure (same facts in → same numbers out);
 *  - versioned (every persisted derived value records the algorithm that produced it);
 *  - provisional. They exist so discovery lenses work today. The real scoring system (reputation-weighted,
 *    calibrated, sybil-resistant) is future work — see prompts/scoring-system-prompt-sketch.md.
 *
 * What must NOT change when the scoring system replaces this file: the raw facts it reads. Any number produced
 * here can be thrown away and recomputed from the database at any time (`npm run metrics:rebuild`).
 */
import { MIN_RATINGS_FOR_CONFIDENCE } from "../vocabulary/discovery";
import { IDEA_SECTIONS, type ClaimStatus, type IdeaSectionKey } from "../vocabulary/knowledge";
import { STANCE_KINDS, type DimensionKey, type StanceKind } from "../vocabulary/signals";

export const BASELINE_ALGORITHM = "baseline-v0";

export interface WeightedObservation {
  value: number;
  weight: number;
}

export interface RatingSummary {
  /** Number of independent raters (current evaluations only). */
  n: number;
  /** Sum of weights. Equals n under uniform weighting. */
  weightSum: number;
  /** Weighted mean on the dimension's native scale (e.g. 1–5). */
  mean: number;
  /** Weighted population standard deviation on the native scale. Disagreement is information. */
  sd: number;
  /** Mean rescaled to 0–1 so different dimensions can be displayed on one meter. */
  normalizedMean: number;
  /** SD rescaled by the scale width. 0.5 is the maximum (a perfect split between both extremes). */
  normalizedSd: number;
}

const round = (x: number, digits = 4) => Math.round(x * 10 ** digits) / 10 ** digits;

/**
 * Weighted mean and spread of ratings on one dimension. Returns null when there is nothing to summarise —
 * absence of data must stay distinguishable from a low score.
 */
export function summarizeRatings(
  observations: readonly WeightedObservation[],
  scale: { min: number; max: number },
): RatingSummary | null {
  const obs = observations.filter((o) => o.weight > 0);
  if (obs.length === 0) return null;
  const weightSum = obs.reduce((a, o) => a + o.weight, 0);
  const mean = obs.reduce((a, o) => a + o.value * o.weight, 0) / weightSum;
  const variance = obs.reduce((a, o) => a + o.weight * (o.value - mean) ** 2, 0) / weightSum;
  const sd = Math.sqrt(variance);
  const width = scale.max - scale.min || 1;
  return {
    n: obs.length,
    weightSum: round(weightSum),
    mean: round(mean),
    sd: round(sd),
    normalizedMean: round((mean - scale.min) / width),
    normalizedSd: round(sd / width),
  };
}

/**
 * How much evaluators of an idea disagree: the widest normalised spread among dimensions that have enough
 * ratings to mean anything. 0 when nothing is confidently rated.
 */
export function contestation(
  summaries: ReadonlyArray<RatingSummary | null>,
  minRatings = MIN_RATINGS_FOR_CONFIDENCE,
): number {
  const spreads = summaries
    .filter((s): s is RatingSummary => !!s && s.n >= minRatings)
    .map((s) => s.normalizedSd);
  return spreads.length ? Math.max(...spreads) : 0;
}

/** Share of narrative sections meaningfully written (≥ `minChars`). Ported from the seedbank MVP. */
export function sectionCompleteness(
  sections: Partial<Record<IdeaSectionKey, string>>,
  minChars = 80,
): number {
  const filled = IDEA_SECTIONS.filter((k) => (sections[k] ?? "").trim().length >= minChars).length;
  return round(filled / IDEA_SECTIONS.length, 2);
}

/** Normalised SD above which a claim with enough assessments is shown as contested. */
export const CONTESTED_NORMALIZED_SD = 0.3;

/**
 * Derives a claim's epistemic status from people's assessments of it.
 *
 * `support` is the "evidential support" dimension (1 refuted … 5 established); `plausibility` distinguishes a
 * reasoned-but-untested hypothesis from a plain unknown. A claim's status is therefore never typed in by
 * anyone — not even its author, whose initial assessment is just one evaluation among others.
 */
export function deriveClaimStatus(
  support: RatingSummary | null,
  plausibility: RatingSummary | null,
): ClaimStatus {
  if (!support) return "unassessed";
  if (support.n >= MIN_RATINGS_FOR_CONFIDENCE && support.normalizedSd >= CONTESTED_NORMALIZED_SD)
    return "contested";
  const m = support.mean;
  if (m >= 4.5) return "established";
  if (m >= 3.5) return "supported";
  if (m >= 2.5) return plausibility && plausibility.mean >= 3.5 ? "hypothesis" : "unknown";
  if (m >= 1.5) return "doubtful";
  return "refuted";
}

export interface PerspectiveSummary {
  /** People currently holding this stance. */
  count: number;
  /** count / holders: of the people who expressed any perspective on the idea, how many hold this one. */
  share: number;
}

/** "Important 82% · Worth researching 76% …" — shares among people who expressed any stance at all. */
export function perspectiveShares(
  counts: Partial<Record<StanceKind, number>>,
  holders: number,
): Record<StanceKind, PerspectiveSummary> {
  const out = {} as Record<StanceKind, PerspectiveSummary>;
  for (const kind of STANCE_KINDS) {
    const count = counts[kind] ?? 0;
    out[kind] = { count, share: holders > 0 ? round(count / holders) : 0 };
  }
  return out;
}

/**
 * WEIGHT POLICY — THE seam for contribution influence.
 *
 * How strongly one evaluator's rating counts. The baseline weighs everyone equally. The future scoring system
 * replaces this with a function of demonstrated, domain-specific contribution quality (never account age,
 * follower counts or popularity), capped so no individual can dominate. Both raw and weighted aggregates
 * should always remain available so weighting is auditable.
 */
export type WeightPolicy = (input: {
  evaluatorId: string;
  dimension: DimensionKey;
  topicIds: readonly string[];
}) => number;

export const uniformWeights: WeightPolicy = () => 1;
