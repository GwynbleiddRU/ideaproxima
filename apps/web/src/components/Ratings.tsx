import { vocabularyField } from "@/lib/vocabulary";
import { useMessage } from "@/locales/react";
import type { RatingSummaryDto } from "@ideaproxima/contracts";
import { DIMENSIONS, type DimensionKey } from "@ideaproxima/domain";
import { anchorsOf, MIN_RATINGS_FOR_CONFIDENCE } from "@/lib/vocabulary";
import { formatDecimal } from "@/lib/format";
import { Meter } from "@/ui/Meter";

/** The scale anchor nearest the mean, e.g. "Transformative" for 3.8 on the impact scale. */
export function nearestAnchor(dimension: DimensionKey, mean: number): string | undefined {
  const anchors = anchorsOf(dimension);
  return anchors.reduce<[number, string] | undefined>(
    (best, a) => (!best || Math.abs(a[0] - mean) < Math.abs(best[0] - mean) ? a : best),
    undefined,
  )?.[1];
}

/** Whether a summary has enough ratings to be shown as a measure (otherwise it is "too early to tell"). */
export const isConfident = (summary: RatingSummaryDto | null | undefined): boolean =>
  !!summary && summary.n >= MIN_RATINGS_FOR_CONFIDENCE;

/**
 * A derived rating summary on one dimension: the nearest scale anchor and the mean, a bar with the spread as a
 * whisker, the number of raters — and honest "not yet rated" / "too early" states below the threshold.
 */
export function RatingMeter({
  dimension,
  summary,
  accent,
  size,
  label,
}: {
  dimension: DimensionKey;
  summary: RatingSummaryDto | null | undefined;
  accent?: boolean;
  size?: "sm" | "md";
  /** A shorter label than the dimension's own (e.g. "Potential" in a narrow column). */
  label?: string;
}) {
  const t = useMessage();
  const anchor = summary ? nearestAnchor(dimension, summary.mean) : undefined;
  const mean = summary ? formatDecimal(summary.mean) : undefined;
  return (
    <Meter
      label={label ?? vocabularyField("dimensions", dimension, "label", DIMENSIONS[dimension].label)}
      value={summary ? summary.value : null}
      spread={summary?.dispersion}
      n={summary?.n}
      minN={MIN_RATINGS_FOR_CONFIDENCE}
      detail={
        summary && (
          <>
            {anchor && <b>{anchor}</b>} {mean}
          </>
        )
      }
      valueText={
        summary
          ? t("idea.rating.accessibleValue", { anchor: anchor ?? "", mean, count: summary.n })
          : undefined
      }
      accent={accent}
      size={size}
    />
  );
}
