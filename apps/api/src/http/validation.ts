import type { z } from "zod";
import type { ValidationIssue } from "@ideaproxima/contracts";
import { DomainError } from "@ideaproxima/domain";
import type { ValidationMessage } from "@ideaproxima/i18n";

type Issue = Omit<ValidationIssue, "message"> & { key: ValidationMessage };

function issueMessage(issue: z.core.$ZodIssue): Pick<Issue, "key" | "params"> {
  switch (issue.code) {
    case "too_small":
    case "too_big": {
      const { code, origin } = issue;
      const key =
        origin === "array"
          ? (`${code}.array` as const)
          : origin === "string"
            ? (`${code}.string` as const)
            : code;
      const params =
        issue.code === "too_small"
          ? { minimum: Number(issue.minimum), inclusive: issue.inclusive ?? true, origin }
          : { maximum: Number(issue.maximum), inclusive: issue.inclusive ?? true, origin };
      return { key, params };
    }
    case "invalid_type":
      return { key: issue.code, params: { expected: issue.expected } };
    case "invalid_format":
      return { key: issue.code, params: { format: issue.format } };
    case "invalid_value":
      return {
        key: issue.code,
        params: {
          values: issue.values.map((value) =>
            typeof value === "bigint" || typeof value === "symbol" ? String(value) : value,
          ),
        },
      };
    case "not_multiple_of":
      return { key: issue.code, params: { divisor: Number(issue.divisor) } };
    case "unrecognized_keys":
    case "invalid_union":
    case "invalid_key":
    case "invalid_element":
      return { key: issue.code, params: {} };
    case "custom": {
      const reason: unknown = issue.params?.reason;
      if (reason === "claim_reference" || reason === "evidence_basis")
        return { key: `custom.${reason}`, params: { reason } };
      return { key: "custom", params: { reason: "invalid_value" } };
    }
  }
}

export class RequestValidationError extends DomainError {
  readonly issues: Issue[];

  constructor(issues: readonly z.core.$ZodIssue[]) {
    super("validation_failed", "invalid_request");
    this.issues = issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      ...issueMessage(issue),
    }));
  }
}
