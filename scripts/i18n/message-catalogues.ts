import type { CompiledMessage } from "@lingui/message-utils/compileMessage";
import { compileMessageOrThrow } from "@lingui/message-utils/compileMessage";
import { MESSAGE_CATALOGUES } from "../../packages/i18n/src/message-catalogues";
import { DEFAULT_LOCALE } from "@ideaproxima/i18n/locales";

type CompiledCatalogue = Record<string, CompiledMessage>;

export function compileMessageCatalogues(): Record<string, CompiledCatalogue> {
  const result: Record<string, CompiledCatalogue> = {};
  for (const [locale, groups] of Object.entries(MESSAGE_CATALOGUES)) {
    const messages: CompiledCatalogue = {};
    for (const [group, entries] of Object.entries(groups)) {
      for (const [id, source] of Object.entries(entries)) {
        const key = `${group}.${id}`;
        try {
          messages[key] = compileMessageOrThrow(source);
        } catch (error) {
          if (locale === DEFAULT_LOCALE)
            throw new Error(`Invalid message ${locale}/${key}`, { cause: error });
          console.warn(`Skipping invalid draft message ${locale}/${key}`);
        }
      }
    }
    result[locale] = messages;
  }
  return result;
}
