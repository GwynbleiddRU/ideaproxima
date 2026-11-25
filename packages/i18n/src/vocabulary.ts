import type { productVocabulary } from "@ideaproxima/domain";
import { vocabulary as ru } from "../catalogs/ru/vocabulary";
import { localeInfo, type Locale } from "./locales";

const FIELDS = ["label", "description", "question", "prompt", "forward", "phrase", "inverse"] as const;
type Vocabulary = ReturnType<typeof productVocabulary>;
type VocabularyText = Partial<Record<(typeof FIELDS)[number], string>>;
type Entry = VocabularyText & { key: string; scale?: { anchors?: Record<number, string> } };

function visit(vocabulary: Vocabulary, map: (key: string, text: string) => string) {
  for (const [group, entries] of Object.entries(vocabulary)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries as Entry[]) {
      if (typeof entry.key !== "string") continue;
      const path = `${group}.${entry.key}`;
      for (const field of FIELDS) {
        const value = entry[field];
        if (typeof value === "string") entry[field] = map(`${path}.${field}`, value);
      }
      const anchors = entry.scale?.anchors;
      if (anchors) {
        for (const [point, value] of Object.entries(anchors)) {
          anchors[Number(point)] = map(`${path}.scale.anchors.${point}`, value);
        }
      }
    }
  }
}

export function extractVocabulary(vocabulary: Vocabulary): Record<string, string> {
  const messages: Record<string, string> = {};
  visit(structuredClone(vocabulary), (key, text) => (messages[key] = text));
  return messages;
}

const drafts: Partial<Record<Locale, Readonly<Record<string, string>>>> = { ru };

export function localizeVocabulary(vocabulary: Vocabulary, locale: Locale): Vocabulary {
  const overlays = [locale, ...localeInfo(locale).fallback]
    .map((tag) => drafts[tag])
    .filter((overlay) => overlay !== undefined);
  if (!overlays.length) return vocabulary;

  const localized = structuredClone(vocabulary);
  visit(localized, (key, text) => {
    for (const overlay of overlays) {
      const translation = overlay[key];
      if (translation !== undefined) return translation;
    }
    return text;
  });
  return localized;
}
