import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorResponse } from "@ideaproxima/contracts";
import {
  DomainError,
  stageProofReason,
  type DomainErrorCode,
  type ErrorParams,
  type ErrorReason,
} from "@ideaproxima/domain";
import { createTranslator } from "@ideaproxima/i18n";
import { sqlState } from "../db/errors";
import { dbErrors } from "../observability/metrics";
import type { AppEnv } from "./env";
import { localizedResponseHeaders, requestLocale } from "./locale";
import { RequestValidationError } from "./validation";

/** The single mapping from domain error codes to HTTP status codes. */
const STATUS: Record<DomainErrorCode, ContentfulStatusCode> = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  unavailable: 503,
  conflict: 409,
  invariant_violated: 422,
};

type ApiErrorCode = DomainErrorCode | "internal_error" | "payload_too_large" | "rate_limited";

export function errorResponse(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: ApiErrorCode,
  reason: ErrorReason,
  params: ErrorParams = {},
  extra?: Readonly<Record<string, unknown>>,
  validation?: RequestValidationError,
) {
  const t = createTranslator(requestLocale(c));
  const proof =
    reason === "stage_requirement_unmet" && typeof params.stage === "string"
      ? stageProofReason(params.stage)
      : undefined;
  const messageParams = proof ? { ...params, requirement: t(`errors.${proof}`) } : params;
  const issues = validation?.issues.map(({ key, ...issue }) => ({
    ...issue,
    message: t(`validation.${key}`, issue.params),
  }));
  localizedResponseHeaders(c);
  if (!c.get("sessionId")) c.header("Cache-Control", "no-store");
  if (code === "unavailable") c.header("Retry-After", "1");
  return c.json<ErrorResponse>(
    {
      error: {
        code,
        message: t(`errors.${reason}`, messageParams),
        requestId: c.get("requestId"),
        details: { ...extra, ...params, reason, issues },
      },
    },
    status,
  );
}

export function recordDatabaseError(err: unknown): string | undefined {
  const code = sqlState(err);
  if (code) dbErrors.inc({ code: code.slice(0, 2) });
  return code;
}

export function handleError(err: Error, c: Context<AppEnv>) {
  if (err instanceof DomainError) {
    return errorResponse(
      c,
      STATUS[err.code],
      err.code,
      err.reason,
      err.params,
      err.details,
      err instanceof RequestValidationError ? err : undefined,
    );
  }
  if (err instanceof HTTPException) {
    return errorResponse(
      c,
      err.status,
      err.status === 404 ? "not_found" : "validation_failed",
      "http_request_failed",
    );
  }
  const code = recordDatabaseError(err);
  switch (code) {
    // Unique violations reach here only on races the services did not pre-check (e.g. concurrent inserts).
    case "23505":
      return errorResponse(c, 409, "conflict", "duplicate_record");
    case "23503":
      return errorResponse(c, 422, "invariant_violated", "missing_reference");
    case "23514":
      return errorResponse(c, 400, "validation_failed", "database_constraint_violated");
    case "57014":
    case "55P03":
      return errorResponse(c, 503, "unavailable", "database_timeout");
    case "40001":
    case "40P01":
      return errorResponse(c, 503, "unavailable", "database_retry_required");
  }
  c.get("errorReporter").report(err, { source: "request", requestId: c.get("requestId") });
  return errorResponse(c, 500, "internal_error", "internal_failure");
}
