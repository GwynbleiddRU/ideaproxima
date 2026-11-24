import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorResponse } from "@ideaproxima/contracts";
import { DomainError, type DomainErrorCode } from "@ideaproxima/domain";
import { dbErrors } from "../observability/metrics";
import type { AppEnv } from "./env";

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

/** Postgres error code, whether thrown directly (postgres-js) or wrapped by Drizzle (`cause`). */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  // PostgreSQL's letter-prefixed classes, plus standard numeric classes. Node codes such as EPIPE differ.
  const sqlState = /^(?:[0-9][0-9A-Z]|F0|HV|P0|XX)[0-9A-Z]{3}$/;
  return [e?.code, e?.cause?.code].find(
    (code): code is string => typeof code === "string" && sqlState.test(code),
  );
}

export function errorResponse(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: unknown,
) {
  return c.json<ErrorResponse>({ error: { code, message, requestId: c.get("requestId"), details } }, status);
}

export function recordDatabaseError(err: unknown): string | undefined {
  const code = pgCode(err);
  if (code) dbErrors.inc({ code: code.slice(0, 2) });
  return code;
}

export function handleError(err: Error, c: Context<AppEnv>) {
  if (err instanceof DomainError) {
    if (err.code === "unavailable") c.header("Retry-After", "1");
    return errorResponse(c, STATUS[err.code], err.code, err.message, err.details);
  }
  if (err instanceof HTTPException) {
    return errorResponse(c, err.status, err.status === 404 ? "not_found" : "validation_failed", err.message);
  }
  const code = recordDatabaseError(err);
  switch (code) {
    // Unique violations reach here only on races the services did not pre-check (e.g. concurrent inserts).
    case "23505":
      return errorResponse(c, 409, "conflict", "That already exists.");
    case "23503":
      return errorResponse(c, 422, "invariant_violated", "A referenced record does not exist.");
    case "23514":
      return errorResponse(c, 400, "validation_failed", "A value violates a database constraint.");
  }
  // Error messages, stacks and causes can contain SQL, parameters and credentials.
  c.get("logger").error({ requestId: c.get("requestId"), pgCode: code }, "unexpected request error");
  return errorResponse(c, 500, "internal_error", "Something went wrong.");
}
