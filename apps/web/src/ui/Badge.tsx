import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Badge.module.scss";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "outline";

/**
 * A small label. `color` (any CSS colour, typically a status token) tints the badge and draws a dot; the text
 * always states the meaning, so colour is never the only cue.
 */
export function Badge({
  tone = "neutral",
  color,
  icon,
  title,
  children,
  className,
}: {
  tone?: Tone;
  color?: string;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const style = color ? ({ "--badge-color": color } as CSSProperties) : undefined;
  return (
    <span
      className={cx(styles.badge, styles[tone], color && styles.tinted, className)}
      style={style}
      title={title}
    >
      {icon ?? (color && <span className={styles.dot} aria-hidden />)}
      {children}
    </span>
  );
}
