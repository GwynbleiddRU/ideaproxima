import { setupI18n, type Values } from "@lingui/core";
import { DEFAULT_LOCALE, intlLocale, localeInfo, type Locale } from "@ideaproxima/i18n/locales";
import { loadCatalogue } from "virtual:web-catalogues";
import type { MessageId } from "./messages";

const english = setupI18n();
export const webI18n = setupI18n();
let current: Locale = DEFAULT_LOCALE;
let request = 0;

export const prepareLocale = loadCatalogue;
type LocaleCatalogue = Awaited<ReturnType<typeof prepareLocale>>;

let extendedEnglishLoaded = false;

/** Lazy routes wait for this shared English fallback before rendering their secondary screens. */
export async function loadExtendedEnglish() {
  if (extendedEnglishLoaded) return;
  const { default: messages } = await import("virtual:web-extended-english");
  if (!extendedEnglishLoaded) {
    english.load(DEFAULT_LOCALE, messages);
    extendedEnglishLoaded = true;
  }
}

export async function activateLocale(locale: Locale) {
  const selection = ++request;
  if (webI18n.locale === locale) return;
  const catalogue = await loadCatalogue(locale);
  // A slow catalogue must not overwrite a more recent selection.
  if (selection === request) setActiveLocale(locale, catalogue);
}

export function activatePreparedLocale(locale: Locale, catalogue: LocaleCatalogue) {
  ++request;
  if (webI18n.locale !== locale) setActiveLocale(locale, catalogue);
}

function setActiveLocale(locale: Locale, catalogue: LocaleCatalogue) {
  const info = localeInfo(locale);
  // Lingui's load merges the fallback tables. Once loaded, extended messages survive locale changes.
  if (!english.locale) {
    english.load(DEFAULT_LOCALE, catalogue.english);
    english.activate(DEFAULT_LOCALE);
  }
  current = locale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = info.direction;
  }
  webI18n.loadAndActivate({ locale, locales: [intlLocale(locale)], messages: catalogue.translated });
}

export const activeLocale = () => current;

export function message(id: MessageId, values?: Values): string {
  return messageCatalogue(id)._(id, values);
}

export function messageCatalogue(id: MessageId) {
  return Object.hasOwn(webI18n.messages, id) ? webI18n : english;
}

export function vocabularyText(id: string, fallback: string): string {
  return Object.hasOwn(webI18n.messages, id) ? webI18n._(id) : fallback;
}

export const formatCount = (id: Extract<MessageId, `count.${string}`>, count: number) =>
  message(id, { count });
