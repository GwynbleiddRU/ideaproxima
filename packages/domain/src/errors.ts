/**
 * Domain errors carry a stable machine-readable code. The HTTP layer maps codes to status codes in exactly
 * one place; services and rules never think about HTTP.
 */
export type DomainErrorCode =
  | "validation_failed" // input is malformed
  | "unauthenticated" // no valid session
  | "forbidden" // authenticated, but not allowed
  | "not_found"
  | "unavailable"
  | "conflict" // concurrent modification / duplicate
  | "invariant_violated"; // well-formed input that breaks a domain rule (e.g. stage transition without proof)

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export const invariant = (condition: unknown, message: string, details?: unknown): asserts condition => {
  if (!condition) throw new DomainError("invariant_violated", message, details);
};

export const notFound = (what: string) => new DomainError("not_found", `${what} not found.`);
