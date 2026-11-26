import { ERROR_MESSAGES, type ErrorReason } from "@ideaproxima/domain";
import { VALIDATION_MESSAGES } from "../catalogs/en/validation";
import { errors } from "../catalogs/ru/errors";
import { validation } from "../catalogs/ru/validation";
import { emails } from "../catalogs/en/emails";
import type { Locale } from "./locales";

export type ValidationMessage = keyof typeof VALIDATION_MESSAGES;
export type MessageId =
  `errors.${ErrorReason}` | `validation.${ValidationMessage}` | `emails.${keyof typeof emails}`;

export const MESSAGE_CATALOGUES: Partial<Record<Locale, Record<string, Readonly<Record<string, string>>>>> = {
  en: { errors: ERROR_MESSAGES, validation: VALIDATION_MESSAGES, emails },
  ru: { errors, validation },
};
