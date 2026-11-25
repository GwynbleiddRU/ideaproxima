import type { VALIDATION_MESSAGES } from "../en/validation";

export const validation = {
  "too_small.string": "Минимальное число символов: {minimum}.",
} satisfies Partial<Record<keyof typeof VALIDATION_MESSAGES, string>>;
