import { useSyncExternalStore } from "react";

/**
 * Theme preference: "system" follows the OS; "light" / "dark" pin it. Stored in localStorage and applied as
 * html[data-theme] (index.html applies it before first paint, so there is no flash).
 */
export type ThemePreference = "system" | "light" | "dark";

const KEY = "ip-theme";
const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

let current: ThemePreference = typeof window === "undefined" ? "system" : read();

export function setTheme(next: ThemePreference) {
  current = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this visit.
  }
  if (next === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTheme = () => useSyncExternalStore(subscribe, () => current);

/** The theme actually shown, resolving "system" through the media query. */
export function resolvedTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
