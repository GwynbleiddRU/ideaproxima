/** Extract SQLSTATE from either driver or the Drizzle error that wraps it. */
export function sqlState(error: unknown): string | undefined {
  const err = error as { code?: unknown; cause?: { code?: unknown } };
  // PostgreSQL's letter-prefixed classes, plus standard numeric classes.
  const format = /^(?:[0-9][0-9A-Z]|F0|HV|P0|XX)[0-9A-Z]{3}$/;
  return [err?.code, err?.cause?.code].find(
    (code): code is string => typeof code === "string" && format.test(code),
  );
}

export const isRetryableTransactionError = (code: string | undefined) => code === "40001" || code === "40P01";
