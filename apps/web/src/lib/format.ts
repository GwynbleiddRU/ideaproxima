/** Formatting helpers. Pure and locale-stable (English UI), so output is the same on server and client. */

const LOCALE = "en";
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
const dateFormat = new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "short", day: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" });
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago", "in 2 hours", "just now". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

const shortDate = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });
const clock = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const SHORT_UNITS: [string, number][] = [
  ["w", 7 * 24 * 3600],
  ["d", 24 * 3600],
  ["h", 3600],
  ["m", 60],
];

/** Compact age for dense lists: "now", "5m", "2h", "3d", "2w", then the date ("Nov 3"). */
export function shortAgo(iso: string, now: number = Date.now()): string {
  const seconds = (now - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "now";
  if (seconds >= 5 * 7 * 24 * 3600) return shortDate.format(new Date(iso));
  for (const [unit, size] of SHORT_UNITS) if (seconds >= size) return `${Math.floor(seconds / size)}${unit}`;
  return "now";
}

/** Time of day ("18:40"), for entries under a day heading. */
export const clockTime = (iso: string) => clock.format(new Date(iso));

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** A day heading: "Today", "Yesterday", or the date ("Nov 14, 2026"). */
export function dayLabel(iso: string, now: number = Date.now()): string {
  const day = dayKey(new Date(iso));
  if (day === dayKey(new Date(now))) return "Today";
  if (day === dayKey(new Date(now - 24 * 3600 * 1000))) return "Yesterday";
  return dateFormat.format(new Date(iso));
}

export const isToday = (iso: string, now: number = Date.now()) =>
  dayKey(new Date(iso)) === dayKey(new Date(now));

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
export const formatCompact = (n: number) => compact.format(n);

/** "1 claim", "3 claims". Irregular plurals pass `many`. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** 0–1 share as a whole percentage. */
export const percent = (share: number) => `${Math.round(share * 100)}%`;

/** First letters of the first two words, for avatars. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}
