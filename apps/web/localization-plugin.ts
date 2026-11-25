import { compileMessageOrThrow } from "@lingui/message-utils/compileMessage";
import { DEFAULT_LOCALE, LOCALES } from "@ideaproxima/i18n/locales";
import { vocabulary as russianVocabulary } from "../../packages/i18n/catalogs/ru/vocabulary.ts";
import type { Plugin } from "vite";
import { englishMessages, translatedMessages } from "./src/locales/messages.ts";
import { LOCALE_STORAGE_KEY, localeDirections } from "./src/locales/bootstrap.ts";

const catalogueModule = "virtual:web-catalogues";
const cataloguePrefix = "virtual:web-catalogue/";
const extendedEnglishModule = "virtual:web-extended-english";
const compile = (entries: Record<string, string>) =>
  Object.fromEntries(Object.entries(entries).map(([id, source]) => [id, compileMessageOrThrow(source)]));
// These messages are only needed by the dedicated pages and the routes that render the activity feed.
const extendedNamespace =
  /^(about|account|activity|activityPage|claimPage|editor|person|search|sourcePage|topic|topics)\./;
const englishEntries = Object.entries(englishMessages);
const english = JSON.stringify(
  compile(Object.fromEntries(englishEntries.filter(([id]) => !extendedNamespace.test(id)))),
);
const extendedEnglish = JSON.stringify(
  compile(Object.fromEntries(englishEntries.filter(([id]) => extendedNamespace.test(id)))),
);
const vocabularyDrafts: Readonly<Record<string, Record<string, string>>> = { ru: russianVocabulary };

export function localizationPlugin(): Plugin {
  return {
    name: "web-localization",
    transformIndexHtml: {
      order: "pre",
      handler: (html) =>
        html
          .replace(
            '"__LOCALE_BOOTSTRAP__"',
            JSON.stringify({
              directions: localeDirections,
              storageKey: LOCALE_STORAGE_KEY,
              fallback: DEFAULT_LOCALE,
            }),
          )
          .replace("__NOSCRIPT_MESSAGE__", () =>
            englishMessages["bootstrap.noScript"].replaceAll("&", "&amp;").replaceAll("<", "&lt;"),
          ),
    },
    resolveId(id) {
      return id === catalogueModule || id === extendedEnglishModule || id.startsWith(cataloguePrefix)
        ? `\0${id}`
        : undefined;
    },
    load(id) {
      if (id === `\0${extendedEnglishModule}`) return `export default ${extendedEnglish};`;
      if (id === `\0${catalogueModule}`) {
        const loaders = LOCALES.map(
          ({ tag }) => `${JSON.stringify(tag)}: () => import(${JSON.stringify(cataloguePrefix + tag)})`,
        );
        return `const loaders = {${loaders.join(",")}}; export const loadCatalogue = (locale) => loaders[locale]();`;
      }
      if (!id.startsWith(`\0${cataloguePrefix}`)) return;
      const locale = id.slice(cataloguePrefix.length + 1);
      const drafts: Readonly<Record<string, Record<string, string>>> = translatedMessages;
      return `export const english = ${english};
export const translated = ${JSON.stringify(compile({ ...vocabularyDrafts[locale], ...drafts[locale] }))};`;
    },
  };
}
