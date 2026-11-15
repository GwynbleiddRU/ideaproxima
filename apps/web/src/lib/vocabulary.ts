/**
 * UI-side access to the product vocabulary. Labels and descriptions come from @ideaproxima/domain (the same
 * definitions the API serves at /v1/vocabulary), so the interface never hard-codes them.
 */
import {
  DIMENSIONS,
  LENS_INFO,
  LENS_KEYS,
  MIN_RATINGS_FOR_CONFIDENCE,
  type DimensionKey,
  type LensKey,
  type LensSignal,
} from "@ideaproxima/domain";

export { MIN_RATINGS_FOR_CONFIDENCE };

export const SIGNAL_INFO: Record<LensSignal, { label: string; description: string }> = {
  time: { label: "Time", description: "Ordered by when things happened." },
  attention: { label: "Attention", description: "What people care about. Popularity, not quality." },
  quality: { label: "Assessed quality", description: "Independent, multi-dimensional evaluations." },
  uncertainty: { label: "Uncertainty", description: "Where knowledge is thin or contested." },
  practice: { label: "Practice", description: "What happened when ideas met the real world." },
};

/** Lenses grouped by the kind of signal they rank on, in display order. */
export const LENS_GROUPS: { signal: LensSignal; lenses: LensKey[] }[] = (
  ["time", "attention", "quality", "uncertainty", "practice"] as const
).map((signal) => ({ signal, lenses: LENS_KEYS.filter((k) => LENS_INFO[k].signal === signal) }));

export const isLensKey = (v: unknown): v is LensKey =>
  typeof v === "string" && LENS_KEYS.includes(v as LensKey);

/** The dimensions an idea card highlights under each lens (the measure the lens ranks on comes first). */
export const LENS_DIMENSIONS: Partial<Record<LensKey, DimensionKey[]>> = {
  evidence: ["evidence", "plausibility"],
  potential: ["impact", "feasibility"],
  feasible: ["feasibility", "impact"],
  developed: ["development", "evidence"],
  neglected: ["impact", "feasibility"],
  contested: ["impact", "plausibility"],
};
export const DEFAULT_CARD_DIMENSIONS: DimensionKey[] = ["impact", "feasibility"];

/** The idea dimensions in the order the epistemic summary shows them. */
export const IDEA_DIMENSIONS: DimensionKey[] = [
  "impact",
  "feasibility",
  "plausibility",
  "evidence",
  "novelty",
  "development",
];

export const dimensionLabel = (key: string) =>
  key in DIMENSIONS ? DIMENSIONS[key as DimensionKey].label : key;

/** Scale anchors of an ordinal dimension, e.g. 1 → "Marginal"; empty for binary ones. */
export function anchorsOf(key: DimensionKey): [number, string][] {
  const scale = DIMENSIONS[key].scale;
  return scale.kind === "ordinal"
    ? Object.entries(scale.anchors).map(([v, label]) => [Number(v), label] as [number, string])
    : [];
}
