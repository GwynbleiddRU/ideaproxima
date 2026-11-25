import { DEFAULT_LOCALE, type Locale } from "@ideaproxima/i18n/locales";
import { matchLocale } from "@ideaproxima/i18n/negotiate";
import { LOCALE_STORAGE_KEY } from "./bootstrap";

let inMemoryPreference: Locale | undefined;

export function resolveLocale(
  explicit?: string,
  stored?: string,
  account?: string,
  languages: readonly string[] = [],
): Locale {
  return (
    matchLocale(explicit) ??
    matchLocale(stored) ??
    matchLocale(account) ??
    languages.map(matchLocale).find((locale) => locale !== undefined) ??
    DEFAULT_LOCALE
  );
}

export function readLocalePreference(): string | undefined {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) ?? undefined;
  } catch {
    return inMemoryPreference;
  }
}

export function writeLocalePreference(locale: Locale) {
  inMemoryPreference = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The in-memory selection still works with storage disabled.
  }
}
