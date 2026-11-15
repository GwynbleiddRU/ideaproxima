import { useSyncExternalStore } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cx } from "@/lib/cx";
import styles from "./Toast.module.scss";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

/** A tiny global toast store: callable from anywhere (mutation callbacks included), rendered by <Toaster />. */
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(tone: Tone, message: string) {
  const id = nextId++;
  items = [...items.slice(-3), { id, tone, message }];
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

const ICONS = { success: CheckCircle2, error: TriangleAlert, info: Info };

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
  return (
    <div className={styles.viewport} aria-live="polite" aria-relevant="additions">
      {list.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            className={cx(styles.toast, styles[t.tone])}
            role={t.tone === "error" ? "alert" : "status"}
          >
            <Icon size={18} aria-hidden className={styles.icon} />
            <p>{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className={styles.dismiss}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
