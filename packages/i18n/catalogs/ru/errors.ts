import type { ErrorReason } from "@ideaproxima/domain";

export const errors = {
  sign_in_required: "Войдите, чтобы выполнить это действие.",
  invalid_request: "Некорректный запрос.",
  handle_taken: "Это имя пользователя уже занято.",
} satisfies Partial<Record<ErrorReason, string>>;
