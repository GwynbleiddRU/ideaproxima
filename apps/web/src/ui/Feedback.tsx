import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { errorMessage } from "@/api/http";
import { cx } from "@/lib/cx";
import styles from "./Feedback.module.scss";

export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role={label ? "status" : undefined}
    >
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}

/** Placeholder lines while content loads. Shapes approximate the content to avoid layout shift. */
export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx(styles.skeleton, className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${i === lines - 1 ? 60 : 100 - (i % 3) * 8}%` }} />
      ))}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className={styles.loadingBlock}>
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx(styles.empty, compact && styles.compact)}>
      {icon && <span className={styles.emptyIcon}>{icon}</span>}
      <p className={styles.emptyTitle}>{title}</p>
      {children && <div className={styles.emptyBody}>{children}</div>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <AlertTriangle aria-hidden size={18} />
      <span>{errorMessage(error)}</span>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          <RotateCw size={14} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

/** Inline form-level error (field errors are shown next to their fields). */
export function FormError({
  error,
  describe = errorMessage,
}: {
  error: unknown;
  describe?: (error: unknown) => string;
}) {
  if (!error) return null;
  return (
    <p className={styles.formError} role="alert">
      <AlertTriangle aria-hidden size={16} />
      {describe(error)}
    </p>
  );
}
