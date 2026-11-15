/**
 * UUIDv7: time-ordered UUIDs (RFC 9562). Chosen over v4 because
 *  - ids sort by creation time, which keeps B-tree indexes compact and gives the activity ledger a natural order;
 *  - they are still globally unique, which lets polymorphic references (evaluations, activities) treat ids from
 *    different tables as one namespace.
 * The 12-bit `rand_a` field is used as a per-millisecond counter so ids generated within one process are
 * strictly increasing.
 */
let lastMs = -1;
let counter = 0;

export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  if (now <= lastMs) {
    counter++;
    if (counter > 0xfff) {
      // Counter exhausted within one millisecond: borrow the next millisecond to stay monotonic.
      lastMs++;
      counter = 0;
    }
  } else {
    lastMs = now;
    counter = bytes[6]! & 0x07; // random start, leaving headroom for increments
  }
  const ms = lastMs;
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ms / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ms / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = 0x70 | ((counter >> 8) & 0x0f);
  bytes[7] = counter & 0xff;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID_RE.test(s);
