import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Meter.module.scss";

/**
 * One measure on a 0–1 track. Uncertainty stays visible:
 *  - `value` null → "not yet rated" (absence of data is never shown as a low score);
 *  - fewer than `minN` observations → "too early to tell", with a hatched track;
 *  - `spread` (0–0.5) draws a whisker around the mean, so disagreement is visible next to the average.
 */
export function Meter({
  label,
  value,
  spread,
  n,
  minN = 0,
  detail,
  accent,
  size = "md",
}: {
  label: ReactNode;
  value: number | null;
  spread?: number;
  n?: number;
  minN?: number;
  /** Text after the bar, e.g. the scale anchor nearest the mean. */
  detail?: ReactNode;
  accent?: boolean;
  size?: "sm" | "md";
}) {
  const unrated = value === null;
  const early = !unrated && n !== undefined && n < minN;
  const style = {
    "--value": `${Math.round((value ?? 0) * 100)}%`,
    "--lo": `${Math.max(0, ((value ?? 0) - (spread ?? 0)) * 100)}%`,
    "--hi": `${Math.min(100, ((value ?? 0) + (spread ?? 0)) * 100)}%`,
  } as CSSProperties;

  const status = unrated ? "Not yet rated" : early ? "Too early to tell" : detail;
  return (
    <div className={cx(styles.meter, styles[size], accent && styles.accent)} style={style}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.meta}>
          {status}
          {n !== undefined && !unrated && <span className={styles.n}> · n={n}</span>}
        </span>
      </div>
      <div
        className={cx(styles.track, (unrated || early) && styles.hatched)}
        {...(unrated || early
          ? { role: "img", "aria-label": `${typeof label === "string" ? label : "Measure"}: ${status}` }
          : {
              role: "meter",
              "aria-valuemin": 0,
              "aria-valuemax": 100,
              "aria-valuenow": Math.round((value ?? 0) * 100),
              "aria-valuetext": typeof status === "string" ? status : undefined,
              "aria-label": typeof label === "string" ? label : undefined,
            })}
      >
        {!unrated && !early && <span className={styles.fill} />}
        {!unrated && !early && spread !== undefined && spread > 0.02 && <span className={styles.spread} />}
        {early && <span className={cx(styles.fill, styles.faint)} />}
      </div>
    </div>
  );
}
