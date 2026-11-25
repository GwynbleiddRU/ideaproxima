import { useMessage } from "@/locales/react";
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
  items = items.filter((item) => item.id !== id);
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
  const t = useMessage();
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
  return (
    <div className={styles.viewport} aria-live="polite" aria-relevant="additions">
      {list.map((item) => {
        const Icon = ICONS[item.tone];
        return (
          <div
            key={item.id}
            className={cx(styles.toast, styles[item.tone])}
            role={item.tone === "error" ? "alert" : "status"}
          >
            <Icon size={18} aria-hidden className={styles.icon} />
            <p>{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={t("toast.dismiss")}
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
