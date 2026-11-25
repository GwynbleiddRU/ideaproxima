import { DomainError } from "@ideaproxima/domain";

/**
 * Cursors are opaque to clients by contract. Internally they are either an offset (for lists sorted by
 * derived metrics, which change between requests anyway) or a keyset position (for chronological streams,
 * which must not skip or repeat items as new rows arrive). Clients never need to know which; the server can
 * switch strategies per endpoint without breaking the API.
 */
export type Cursor = { o: number } | { t: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    if ("o" in value && Number.isInteger(value.o) && value.o >= 0) return value;
    if ("t" in value && typeof value.t === "string" && typeof value.id === "string") return value;
  } catch {
    // fall through
  }
  throw new DomainError("validation_failed", "invalid_cursor");
}

export function offsetFrom(raw: string | undefined): number {
  const c = decodeCursor(raw);
  if (!c) return 0;
  if (!("o" in c)) throw new DomainError("validation_failed", "wrong_cursor_type");
  if (c.o > 10_000) throw new DomainError("validation_failed", "offset_limit_exceeded");
  return c.o;
}

export function keysetFrom(raw: string | undefined): { t: Date; id: string } | null {
  const c = decodeCursor(raw);
  if (!c) return null;
  if (!("t" in c)) throw new DomainError("validation_failed", "wrong_cursor_type");
  return { t: new Date(c.t), id: c.id };
}

/** Given `limit + 1` fetched rows, returns the page and whether there is more. */
export function splitPage<T>(rows: T[], limit: number): { items: T[]; hasMore: boolean } {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}
