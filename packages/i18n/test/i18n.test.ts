import { expect, it } from "vitest";
import { productVocabulary } from "@ideaproxima/domain";
import { compileMessageCatalogues } from "../../../scripts/i18n/message-catalogues";
import { COMPILED_MESSAGES } from "../src/compiled-messages";
import catalogue from "../catalogs/en/vocabulary.json";
import {
  createTranslator,
  extractVocabulary,
  intlLocale,
  isRtl,
  localizeVocabulary,
  matchLocale,
  negotiateLocale,
} from "../src";

it("looks up language ranges by quality, specificity and canonical tag", () => {
  expect(negotiateLocale("en-GB;q=0.2, ru-RU;q=0.9, invalid;q=0, de;q=0.8")).toBe("ru");
  expect(negotiateLocale("ru;q=0, fr;q=1.1, de;q=0.5")).toBe("de");
  expect(negotiateLocale("ES-mx, ru")).toBe("es");
  expect(negotiateLocale("en;q=0, *;q=0.6, es;q=0")).toBe("zh-Hans");
  expect(negotiateLocale("de-DE-u-co-phonebk")).toBe("de");
  expect(negotiateLocale("zz-ZZ")).toBe("en");
  expect(negotiateLocale()).toBe("en");
  expect(negotiateLocale("en-US", ["fr", "en-US"])).toBe("en-US");
  expect(negotiateLocale("*", [])).toBeUndefined();

  for (const alias of ["zh", "zh-CN", "zh-SG", "zh-TW", "zh-HK"]) expect(matchLocale(alias)).toBe("zh-Hans");
  for (const alias of ["pt", "pt-PT", "PT-br"]) expect(matchLocale(alias)).toBe("pt-BR");
  expect(matchLocale("in-ID")).toBe("id");
  expect(matchLocale("ru,en")).toBeUndefined();
  expect(isRtl("ar")).toBe(true);
  expect(intlLocale("ar")).toBe("ar-u-nu-latn");
});

it("checks freshness of the compiled ICU messages", () => {
  expect(COMPILED_MESSAGES).toEqual(compileMessageCatalogues());
});

it("formats messages independently and falls back to English for missing translations", () => {
  const ru = createTranslator("ru");
  const en = createTranslator("en");
  expect(ru("errors.sign_in_required")).toBe("Войдите, чтобы выполнить это действие.");
  expect(en("errors.sign_in_required")).toBe("Sign in to do this.");
  expect(ru("errors.database_timeout")).toBe(en("errors.database_timeout"));
  expect(en("validation.too_small.string", { minimum: 1 })).toBe("Use at least 1 character.");
  expect(en("validation.too_small.string", { minimum: 3 })).toBe("Use at least 3 characters.");
  expect(ru("validation.too_small.string", { minimum: 3 })).toBe("Минимальное число символов: 3.");
  expect(createTranslator("ar")("errors.rating_out_of_range", { dimension: "impact", min: 1, max: 5 })).toBe(
    '"impact" must be an integer from 1 to 5.',
  );
});

it("checks the generated vocabulary and overlays only selected copy", () => {
  const english = productVocabulary();
  expect(extractVocabulary(english)).toEqual(catalogue);
  const configured = localizeVocabulary(english, "ru");
  const expected = structuredClone(english);
  expected.stages[0]!.label = "Замысел";
  expect(configured).toEqual(expected);
  expect(english.stages[0]!.label).toBe("Imagined");
  expect(localizeVocabulary(english, "ko")).toEqual(english);
});
