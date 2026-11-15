import { useId } from "react";
import { cx } from "@/lib/cx";
import styles from "./Segmented.module.scss";

/** A compact single-choice control (radio group semantics, rendered as a segmented bar). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cx(styles.group, styles[size])}>
      {options.map((option) => (
        <label key={String(option.value)} className={styles.option} title={option.title}>
          <input
            type="radio"
            name={name}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className={styles.input}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
