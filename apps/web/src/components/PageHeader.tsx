import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./PageHeader.module.scss";

/** The top of a page: eyebrow, serif title, lede and optional actions. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx(styles.header, className)}>
      <div className={styles.text}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {lede && <p className={styles.lede}>{lede}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

/** A section heading inside a page, with an optional action on the right. */
export function SectionHeading({
  eyebrow,
  title,
  action,
  id,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className={styles.section}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
