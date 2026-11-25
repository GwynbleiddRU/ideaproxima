import { LOCALES } from "@ideaproxima/i18n/locales";

export const LOCALE_STORAGE_KEY = "ip-locale";
export const localeDirections = Object.fromEntries(LOCALES.map(({ tag, direction }) => [tag, direction]));
