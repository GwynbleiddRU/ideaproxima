import { createLink } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, Ref } from "react";
import { cx } from "@/lib/cx";
import styles from "./Chip.module.scss";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** When set, the chip is a toggle (aria-pressed). */
  pressed?: boolean;
  /** Small count shown after the label. */
  count?: number;
}

export function Chip({ pressed, count, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      className={cx(styles.chip, pressed && styles.active, className)}
      aria-pressed={pressed}
      {...rest}
    >
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </button>
  );
}

function ChipAnchor({
  className,
  ref,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { ref?: Ref<HTMLAnchorElement> }) {
  return <a ref={ref} className={cx(styles.chip, className)} {...rest} />;
}

/** A router link styled as a chip; the active route gets the pressed look via `data-status="active"`. */
export const ChipLink = createLink(ChipAnchor);

export const chipStyles = styles;
