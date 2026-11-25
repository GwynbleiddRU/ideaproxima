import { DomainError } from "../errors";
import {
  DIMENSIONS,
  MUTUALLY_EXCLUSIVE_STANCES,
  isDimensionKey,
  type ConfidenceLevel,
  type DimensionKey,
  type EvaluationTargetKind,
  type StanceKind,
} from "../vocabulary/signals";

export interface RatingInput {
  dimension: string;
  value: number;
  confidence?: ConfidenceLevel | null;
}

export interface ValidRating {
  dimension: DimensionKey;
  value: number;
  confidence: ConfidenceLevel | null;
}

/**
 * Validates a set of ratings for one target.
 *
 * Every dimension is optional: "I don't know" is a legitimate answer and is expressed by *omitting* the
 * dimension, never by a zero or a midpoint. That keeps uncertainty out of the averages instead of hiding in them.
 */
export function validateRatings(
  target: EvaluationTargetKind,
  ratings: readonly RatingInput[],
): ValidRating[] {
  if (ratings.length === 0) {
    throw new DomainError("validation_failed", "ratings_required");
  }
  const seen = new Set<string>();
  return ratings.map((r) => {
    if (!isDimensionKey(r.dimension)) {
      throw new DomainError("validation_failed", "unknown_dimension", { dimension: r.dimension });
    }
    const def = DIMENSIONS[r.dimension];
    if (!(def.appliesTo as readonly string[]).includes(target)) {
      throw new DomainError("validation_failed", "dimension_not_applicable", {
        dimension: r.dimension,
        target,
      });
    }
    if (seen.has(r.dimension)) {
      throw new DomainError("validation_failed", "dimension_rated_twice", { dimension: r.dimension });
    }
    seen.add(r.dimension);
    const scale = def.scale;
    if (scale.kind === "binary") {
      if (r.value !== 1)
        throw new DomainError("validation_failed", "binary_rating_value", { dimension: r.dimension });
    } else if (!Number.isInteger(r.value) || r.value < scale.min || r.value > scale.max) {
      throw new DomainError("validation_failed", "rating_out_of_range", {
        dimension: r.dimension,
        min: scale.min,
        max: scale.max,
      });
    }
    return { dimension: r.dimension, value: r.value, confidence: r.confidence ?? null };
  });
}

/** Stances that must be retracted when `kind` is taken (e.g. "plausible" retracts "doubtful"). */
export function stancesDisplacedBy(kind: StanceKind): StanceKind[] {
  const out: StanceKind[] = [];
  for (const [a, b] of MUTUALLY_EXCLUSIVE_STANCES) {
    if (a === kind) out.push(b);
    if (b === kind) out.push(a);
  }
  return out;
}
