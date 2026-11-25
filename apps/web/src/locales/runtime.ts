import { setupI18n, type Values } from "@lingui/core";
import { DEFAULT_LOCALE, intlLocale, localeInfo, type Locale } from "@ideaproxima/i18n/locales";
import { loadCatalogue } from "virtual:web-catalogues";
import type { MessageId } from "./messages";

const english = setupI18n();
export const webI18n = setupI18n();
let current: Locale = DEFAULT_LOCALE;
let request = 0;

export const prepareLocale = loadCatalogue;

export async function activateLocale(locale: Locale) {
  const selection = ++request;
  if (webI18n.locale === locale) return true;
  const catalogue = await loadCatalogue(locale);
  // A slow catalogue must not overwrite a more recent selection.
  if (selection !== request) return false;
  const info = localeInfo(locale);
  english.loadAndActivate({ locale: DEFAULT_LOCALE, messages: catalogue.english });
  current = locale;
  document.documentElement.lang = locale;
  document.documentElement.dir = info.direction;
  webI18n.loadAndActivate({ locale, locales: [intlLocale(locale)], messages: catalogue.translated });
  return true;
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
