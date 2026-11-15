import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorResponse } from "@ideaproxima/contracts";
import { DomainError, type DomainErrorCode } from "@ideaproxima/domain";

/** The single mapping from domain error codes to HTTP status codes. */
const STATUS: Record<DomainErrorCode, ContentfulStatusCode> = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invariant_violated: 422,
};

/** Postgres error code, whether thrown directly (postgres-js) or wrapped by Drizzle (`cause`). */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  const code =
    typeof e?.code === "string" ? e.code : typeof e?.cause?.code === "string" ? e.cause.code : undefined;
  return code && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

const body = (code: string, message: string, details?: unknown): ErrorResponse => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

export function handleError(err: Error, c: Context) {
  if (err instanceof DomainError) return c.json(body(err.code, err.message, err.details), STATUS[err.code]);
  if (err instanceof HTTPException) return c.json(body("http_error", err.message), err.status);
  switch (pgCode(err)) {
    // Unique violations reach here only on races the services did not pre-check (e.g. concurrent inserts).
    case "23505":
      return c.json(body("conflict", "That already exists."), 409);
    case "23503":
      return c.json(body("invariant_violated", "A referenced record does not exist."), 422);
    case "23514":
      return c.json(body("validation_failed", "A value violates a database constraint."), 400);
  }
  console.error(err);
  return c.json(body("internal_error", "Something went wrong."), 500);
}
