import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { DomainError } from "@ideaproxima/domain";
import { loadPasswordHashLimits } from "../../config";
import { passwordHashQueueDepth } from "../../observability/metrics";

/**
 * Password hashing with Node's built-in scrypt (memory-hard, no native dependency).
 * Format: scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url> — parameters are stored so they can be raised later
 * without invalidating existing hashes.
 */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * N * R * 2;
let limits: ReturnType<typeof loadPasswordHashLimits> | undefined;
let active = 0;
const waiting: Array<() => void> = [];

async function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  limits ??= loadPasswordHashLimits();
  if (active < limits.concurrency) {
    active++;
  } else {
    if (waiting.length >= limits.queue) throw new DomainError("unavailable", "password_service_busy");
    await new Promise<void>((resolve) => {
      waiting.push(resolve);
      passwordHashQueueDepth.set(waiting.length);
    });
  }
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
        err ? reject(err) : resolve(key),
      ),
    );
  } finally {
    // Hand the occupied slot directly to the oldest waiter, including when scrypt fails.
    const next = waiting.shift();
    if (next) {
      passwordHashQueueDepth.set(waiting.length);
      next();
    } else active--;
  }
}

async function previouslyBreached(password: string): Promise<boolean> {
  const digest = createHash("sha1").update(password.normalize("NFKC")).digest("hex").toUpperCase();
  try {
    const result = await fetch("https://api.pwnedpasswords.com/range/" + digest.slice(0, 5), {
      signal: AbortSignal.timeout(1500),
      redirect: "error",
      headers: { "Add-Padding": "true", "User-Agent": "Ideaproxima" },
    });
    if (!result.ok) {
      await result.body?.cancel();
      return false;
    }
    const suffix = digest.slice(5);
    return (await result.text()).split(/\r?\n/).some((line) => {
      const [candidate, count] = line.split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export async function hashPassword(password: string, check: "off" | "hibp" = "off"): Promise<string> {
  if (check === "hibp" && (await previouslyBreached(password)))
    throw new DomainError("validation_failed", "password_breached");
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

// Unknown and inactive accounts still perform the same scrypt check, with a random comparison value.
const dummyPasswordHash = [
  "scrypt",
  N,
  R,
  P,
  randomBytes(16).toString("base64url"),
  randomBytes(KEYLEN).toString("base64url"),
].join("$");

export async function verifyPassword(password: string, stored: string = dummyPasswordHash): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Session tokens: 256 bits of randomness; only the SHA-256 is persisted. */
export const newSessionToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
