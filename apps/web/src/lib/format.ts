import { intlLocale, isLocale } from "@ideaproxima/i18n/locales";

const formatters = (locale: string) => ({
  relative: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
  date: new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }),
  dateTime: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
  shortDate: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }),
  clock: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  compact: new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }),
  number: new Intl.NumberFormat(locale),
  decimal: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  paddedNumber: new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }),
  percent: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }),
  list: new Intl.ListFormat(locale),
  shortUnits: Object.fromEntries(
    SHORT_UNITS.map(([unit]) => [
      unit,
      new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow" }),
    ]),
  ),
});

let activeIntl: string | undefined;
let activeFormatters: ReturnType<typeof formatters>;
function formats() {
  const language = typeof document === "undefined" ? "en" : document.documentElement.lang;
  const locale = isLocale(language) ? intlLocale(language) : "en";
  if (activeIntl !== locale) {
    activeFormatters = formatters(locale);
    activeIntl = locale;
  }
  return activeFormatters;
}

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
  const { relative } = formats();
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(0, "second");
}

const SHORT_UNITS = [
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
] as const;

/** Compact age for dense lists: "now", "5m", "2h", "3d", "2w", then the date ("Nov 3"). */
export function shortAgo(iso: string, now: number = Date.now()): string {
  const seconds = (now - new Date(iso).getTime()) / 1000;
  const { relative, shortDate, shortUnits } = formats();
  if (seconds < 60) return relative.format(0, "second");
  if (seconds >= 5 * 7 * 24 * 3600) return shortDate.format(new Date(iso));
  for (const [unit, size] of SHORT_UNITS)
    if (seconds >= size) return shortUnits[unit]!.format(Math.floor(seconds / size));
  return relative.format(0, "second");
}

/** Time of day ("18:40"), for entries under a day heading. */
export const clockTime = (iso: string) => formats().clock.format(new Date(iso));

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** A day heading: "Today", "Yesterday", or the date ("Nov 14, 2026"). */
export function dayLabel(iso: string, now: number = Date.now()): string {
  const day = dayKey(new Date(iso));
  const { relative, date } = formats();
  const today = new Date(now);
  if (day === dayKey(today)) return heading(relative.format(0, "day"));
  today.setDate(today.getDate() - 1);
  if (day === dayKey(today)) return heading(relative.format(-1, "day"));
  return date.format(new Date(iso));
}

const heading = (value: string) => value.charAt(0).toLocaleUpperCase(activeIntl) + value.slice(1);

export const isToday = (iso: string, now: number = Date.now()) =>
  dayKey(new Date(iso)) === dayKey(new Date(now));

export const formatDate = (iso: string) => formats().date.format(new Date(iso));
export const formatDateTime = (iso: string) => formats().dateTime.format(new Date(iso));
export const formatCompact = (n: number) => formats().compact.format(n);
export const formatNumber = (n: number) => formats().number.format(n);
export const formatDecimal = (n: number) => formats().decimal.format(n);
export const formatPaddedNumber = (n: number) => formats().paddedNumber.format(n);
export const formatList = (values: string[]) => formats().list.format(values);
export const formatListParts = (values: string[]) => formats().list.formatToParts(values);

/** 0–1 share as a whole percentage. */
export const percent = (share: number) => formats().percent.format(share);

/** First letters of the first two words, for avatars. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}
