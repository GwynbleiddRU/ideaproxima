import { setupI18n, type Messages } from "@lingui/core";
import { COMPILED_MESSAGES } from "./compiled-messages";
import { DEFAULT_LOCALE, intlLocale, localeInfo, type Locale } from "./locales";
import type { MessageId } from "./message-catalogues";

export type { MessageId, ValidationMessage } from "./message-catalogues";

function formatter(locale: Locale, messages: Messages) {
  return setupI18n({ locale, locales: intlLocale(locale), messages: { [locale]: messages } });
}

const english = formatter(DEFAULT_LOCALE, COMPILED_MESSAGES.en);
const formatters = new Map(
  Object.entries(COMPILED_MESSAGES)
    .filter(([tag]) => tag !== DEFAULT_LOCALE)
    .map(([tag, messages]) => {
      const locale = tag as Locale;
      return [locale, formatter(locale, messages)];
    }),
);

/** Each formatter stays in its own locale. Fallback plurals and numbers use the message's locale. */
export function createTranslator(locale: Locale) {
  const chain = [locale, ...localeInfo(locale).fallback];
  return (key: MessageId, params?: Readonly<Record<string, unknown>>): string => {
    for (const tag of chain) {
      const active = formatters.get(tag);
      if (active && Object.hasOwn(active.messages, key)) return active.t(key, params);
    }
    return english.t(key, params);
  };
}
