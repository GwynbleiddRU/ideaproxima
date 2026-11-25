import { englishErrorMessage, type ErrorParams, type ErrorReason } from "./errors.en";

/**
 * Domain errors carry a stable machine-readable code. The HTTP layer maps codes to status codes in exactly
 * one place; services and rules never think about HTTP.
 */
export type DomainErrorCode =
  | "validation_failed" // input is malformed
  | "unauthenticated" // no valid session
  | "forbidden" // authenticated, but not allowed
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "conflict" // concurrent modification / duplicate
  | "invariant_violated"; // well-formed input that breaks a domain rule (e.g. stage transition without proof)

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    readonly reason: ErrorReason,
    readonly params: ErrorParams = {},
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(englishErrorMessage(reason, params));
    this.name = "DomainError";
  }
}

/** Reasons describe the resource even when the response deliberately hides its existence. */
export const notFound = (reason: Extract<ErrorReason, `${string}_not_found`>) =>
  new DomainError("not_found", reason);
