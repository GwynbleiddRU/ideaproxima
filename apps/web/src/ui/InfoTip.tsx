import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { useMessage } from "@/locales/react";
import styles from "./InfoTip.module.scss";

/**
 * "How is this computed?" — a small disclosure that explains a number in place. Click (or Enter) toggles it;
 * it works on touch screens and with keyboards, unlike a hover-only tooltip.
 */
export function InfoTip({ label, children }: { label?: string; children: ReactNode }) {
  const t = useMessage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className={styles.root} ref={root}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={label ?? t("feedback.howComputed")}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle size={14} aria-hidden />
      </button>
      {open && (
        <span id={id} role="note" className={styles.panel}>
          {children}
        </span>
      )}
    </span>
  );
}
