import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Dropdown.module.scss";

/**
 * A menu button: the trigger toggles a panel of actions. Closes on outside click, Escape (returning focus to
 * the trigger) and after an item is chosen.
 */
export function Dropdown({
  trigger,
  label,
  children,
  align = "end",
  triggerClassName,
}: {
  trigger: ReactNode;
  label: string;
  /** Receives `close` so items can dismiss the menu. */
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div className={styles.root} ref={root}>
      <button
        ref={button}
        type="button"
        className={cx(styles.trigger, triggerClassName)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div id={menuId} role="menu" className={cx(styles.menu, styles[align])}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

export const menuItemClass = styles.item;
export const menuSeparatorClass = styles.separator;
export const menuLabelClass = styles.label;
