import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useMessage } from "@/locales/react";
import styles from "./Meter.module.scss";

/**
 * How many observations a measure has towards the number it needs: ●○○ for 1 of 3. Decorative; the text next to
 * it says the same in words.
 */
export function Dots({ n, of }: { n: number; of: number }) {
  return (
    <span className={styles.dots} aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={cx(i < n && styles.on)} />
      ))}
    </span>
  );
}

/**
 * One measure on a 0–1 track. Uncertainty stays visible without looking like a low score:
 *  - `value` null → "Not yet rated" (○○○), no bar — absence of data is never drawn as a short bar;
 *  - fewer than `minN` observations → "Too early · 1 of 3" (●○○), no bar, so the reader sees what would change it;
 *  - `spread` (0–0.5) draws a whisker around the mean, so disagreement is visible next to the average.
 */
export function Meter({
  label,
  value,
  spread,
  n,
  minN = 0,
  detail,
  valueText,
  accent,
  size = "md",
}: {
  label: ReactNode;
  value: number | null;
  spread?: number;
  n?: number;
  minN?: number;
  /** Text after the label, e.g. the scale anchor nearest the mean. */
  detail?: ReactNode;
  /** The value in words for assistive technology, e.g. "Transformative, 3.8 of 5, 3 ratings". */
  valueText?: string;
  accent?: boolean;
  size?: "sm" | "md";
}) {
  const t = useMessage();
  const unrated = value === null;
  const early = !unrated && n !== undefined && n < minN;
  const name = typeof label === "string" ? label : t("meter.name");

  if (unrated || early) {
    const count = unrated ? 0 : n!;
    const text = unrated
      ? t("meter.unrated")
      : size === "sm"
        ? t("common.progress", { count, total: minN })
        : t("meter.early", { count, total: minN });
    return (
      <div className={cx(styles.meter, styles[size])}>
        <div className={styles.head}>
          <span className={styles.label}>{label}</span>
          <span
            className={styles.early}
            title={
              unrated ? t("meter.unratedHint", { name }) : t("meter.earlyHint", { name, count, total: minN })
            }
          >
            {minN > 0 && <Dots n={count} of={minN} />}
            <span aria-hidden={early && size === "sm" ? true : undefined}>{text}</span>
            {early && size === "sm" && (
              <span className="visually-hidden">{t("meter.earlyAccessible", { count, total: minN })}</span>
            )}
          </span>
        </div>
      </div>
    );
  }

  const style = {
    "--value": `${Math.round(value * 100)}%`,
    "--lo": `${Math.max(0, (value - (spread ?? 0)) * 100)}%`,
    "--hi": `${Math.min(100, (value + (spread ?? 0)) * 100)}%`,
  } as CSSProperties;
  return (
    <div className={cx(styles.meter, styles[size], accent && styles.accent)} style={style}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.meta}>
          {detail}
          {n !== undefined && <span className={styles.n}>{t("meter.sampleSize", { count: n })}</span>}
        </span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={valueText}
        aria-label={name}
      >
        <span className={styles.fill} />
        {spread !== undefined && spread > 0.02 && <span className={styles.spread} />}
      </div>
    </div>
  );
}
