import { ERROR_MESSAGES, type ErrorReason } from "@ideaproxima/domain";
import { VALIDATION_MESSAGES } from "../catalogs/en/validation";
import { errors } from "../catalogs/ru/errors";
import { validation } from "../catalogs/ru/validation";
import type { Locale } from "./locales";

export type ValidationMessage = keyof typeof VALIDATION_MESSAGES;
export type MessageId = `errors.${ErrorReason}` | `validation.${ValidationMessage}`;

export const MESSAGE_CATALOGUES = {
  en: { errors: ERROR_MESSAGES, validation: VALIDATION_MESSAGES },
  ru: { errors, validation },
} satisfies Partial<Record<Locale, Record<string, Readonly<Record<string, string>>>>>;
