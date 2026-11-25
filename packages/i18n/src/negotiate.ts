import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

const ALIASES = new Map<string, Locale>([
  ["zh", "zh-Hans"],
  ["pt", "pt-BR"],
  ["in", "id"],
]);

function lookup<T extends string>(range: string, supported: ReadonlyMap<string, T>): T | undefined {
  if (range === "*") return undefined;
  while (range) {
    const alias = ALIASES.get(range)?.toLowerCase();
    const match = supported.get(range) ?? (alias ? supported.get(alias) : undefined);
    if (match) return match;
    // RFC 4647 lookup also removes a singleton when its extension is truncated.
    range = range.slice(0, Math.max(0, range.lastIndexOf("-"))).replace(/-[a-z0-9]$/, "");
  }
  return undefined;
}

const supportedLocales = LOCALES.map(({ tag }) => tag);
const byLocale = new Map(supportedLocales.map((tag) => [tag.toLowerCase(), tag]));
const LANGUAGE_RANGE = "[a-z]{1,8}(?:-[a-z0-9]{1,8})*";
const SINGLE_RANGE = new RegExp(`^${LANGUAGE_RANGE}$`, "i");
const WEIGHTED_RANGE = new RegExp(
  `^\\s*(\\*|${LANGUAGE_RANGE})(?:\\s*;\\s*q\\s*=\\s*(0(?:\\.\\d{0,3})?|1(?:\\.0{0,3})?))?\\s*$`,
  "i",
);

export function matchLocale(tag?: string): Locale | undefined {
  return tag && tag.length <= 128 && SINGLE_RANGE.test(tag) ? lookup(tag.toLowerCase(), byLocale) : undefined;
}

export function negotiateLocale(preferences?: string): Locale;
export function negotiateLocale<T extends string>(
  preferences: string | undefined,
  supported: readonly T[],
): T | undefined;
export function negotiateLocale(
  preferences = "",
  supported: readonly string[] = supportedLocales,
): string | undefined {
  const byTag =
    supported === supportedLocales ? byLocale : new Map(supported.map((tag) => [tag.toLowerCase(), tag]));
  const ranges = preferences.split(",").flatMap((part) => {
    const match = WEIGHTED_RANGE.exec(part);
    return match ? [{ tag: match[1]!.toLowerCase(), quality: Number(match[2] ?? 1) }] : [];
  });
  const mentioned = new Set(ranges.map(({ tag }) => lookup(tag, byTag)));
  const defaultLocale = byTag.get(DEFAULT_LOCALE) ?? supported[0];
  for (const { tag, quality } of ranges.sort((a, b) => b.quality - a.quality)) {
    if (quality === 0) break;
    if (tag === "*") {
      const match = supported.find((entry) => !mentioned.has(entry));
      if (match) return match;
    }
    const match = lookup(tag, byTag);
    if (match) return match;
  }
  return defaultLocale;
}
