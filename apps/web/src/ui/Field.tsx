import { useMessage } from "@/locales/react";
import { useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Field.module.scss";

export interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Label + control + hint/error, wired for assistive technology. The control is rendered by the caller through
 * a render prop, receiving the ids it must carry:
 *
 *   <Field label="Title" error={errors.title}>{(p) => <input {...p} className={control} />}</Field>
 */
export function Field({
  label,
  hint,
  error,
  optional,
  counter,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** e.g. "120 / 600" */
  counter?: string;
  children: (props: ControlProps) => ReactNode;
  className?: string;
}) {
  const t = useMessage();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {optional && <span className={styles.optional}>{t("field.optional")}</span>}
        </label>
        {counter && <span className={styles.counter}>{counter}</span>}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Class for <input>, <textarea> and <select>. */
export const control = styles.control;
export const controlLarge = cx(styles.control, styles.large);

/** A fieldset of radio-like options rendered as cards (used for scales and choices). */
export function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{legend}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </fieldset>
  );
}
