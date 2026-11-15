import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/lib/cx";
import styles from "./Dialog.module.scss";

/**
 * Modal dialog on the native <dialog> element: focus trapping, Escape to close, the top layer and an inert
 * background come from the platform. Content mounts only while open, so forms start fresh each time.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size])}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself; clicks inside land on its content.
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby={titleId}
    >
      {open && (
        <div className={styles.panel}>
          <header className={styles.header}>
            <div>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && <p className={styles.description}>{description}</p>}
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
