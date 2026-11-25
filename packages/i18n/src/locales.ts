export const DEFAULT_LOCALE = "en";

function locale<T extends string>(
  tag: T,
  name: string,
  options?: { direction?: "ltr" | "rtl"; intl?: string; status?: "beta" | "released" },
) {
  return {
    tag,
    name,
    direction: options?.direction ?? "ltr",
    intl: options?.intl ?? tag,
    status: options?.status ?? "beta",
    fallback: tag === DEFAULT_LOCALE ? ([] as const) : ([DEFAULT_LOCALE] as const),
  } as const;
}

export const LOCALES = [
  locale("en", "English"),
  locale("zh-Hans", "简体中文"),
  locale("es", "Español"),
  locale("ar", "العربية", { direction: "rtl", intl: "ar-u-nu-latn" }),
  locale("pt-BR", "Português (Brasil)"),
  locale("id", "Bahasa Indonesia"),
  locale("fr", "Français"),
  locale("ja", "日本語"),
  locale("ru", "Русский"),
  locale("de", "Deutsch"),
  locale("hi", "हिन्दी"),
  locale("ko", "한국어"),
] as const;

export type Locale = (typeof LOCALES)[number]["tag"];
const byTag = new Map(LOCALES.map((entry) => [entry.tag, entry]));

export function isLocale(tag: string): tag is Locale {
  return byTag.has(tag as Locale);
}

export function localeInfo(tag: Locale) {
  return byTag.get(tag)!;
}

export const isRtl = (tag: Locale) => localeInfo(tag).direction === "rtl";
export const intlLocale = (tag: Locale) => localeInfo(tag).intl;
