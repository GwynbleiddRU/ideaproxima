import type { RatingSummaryDto } from "@ideaproxima/contracts";
import { DIMENSIONS, type DimensionKey } from "@ideaproxima/domain";
import { anchorsOf, MIN_RATINGS_FOR_CONFIDENCE } from "@/lib/vocabulary";
import { Meter } from "@/ui/Meter";

/** The scale anchor nearest the mean, e.g. "Transformative" for 3.8 on the impact scale. */
export function nearestAnchor(dimension: DimensionKey, mean: number): string | undefined {
  const anchors = anchorsOf(dimension);
  return anchors.reduce<[number, string] | undefined>(
    (best, a) => (!best || Math.abs(a[0] - mean) < Math.abs(best[0] - mean) ? a : best),
    undefined,
  )?.[1];
}

/**
 * A derived rating summary on one dimension: mean as a bar, dispersion as a whisker, the number of raters, and
 * honest states for "not yet rated" and "too early to tell".
 */
export function RatingMeter({
  dimension,
  summary,
  accent,
  size,
}: {
  dimension: DimensionKey;
  summary: RatingSummaryDto | null | undefined;
  accent?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <Meter
      label={DIMENSIONS[dimension].label}
      value={summary ? summary.value : null}
      spread={summary?.dispersion}
      n={summary?.n}
      minN={MIN_RATINGS_FOR_CONFIDENCE}
      detail={
        summary ? `${nearestAnchor(dimension, summary.mean) ?? ""} (${summary.mean.toFixed(1)})` : undefined
      }
      accent={accent}
      size={size}
    />
  );
}
