import { DomainError } from "@ideaproxima/domain";
import { isLocale, type Locale } from "@ideaproxima/i18n";

export function requireLocale(tag: string): Locale {
  if (!isLocale(tag)) throw new DomainError("validation_failed", "unsupported_locale");
  return tag;
}
