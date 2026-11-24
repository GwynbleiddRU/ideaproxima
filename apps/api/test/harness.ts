import { appendFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { eq } from "drizzle-orm";
import { ErrorResponse, matchEndpoint, type AuthResponse, type IdeaDetail } from "@ideaproxima/contracts";
import type { PersonRole } from "@ideaproxima/domain";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import type { Database } from "../src/db/client";
import { ensureBaseTopics } from "../src/db/reference-data";
import { people } from "../src/db/schema";
import { openTestDatabase } from "./database";

/**
 * Integration harness: a fresh, fully migrated Postgres database (in-memory PGlite by default, or a throwaway
 * database on a real server when TEST_DATABASE_URL is set — see ./database.ts) and the real HTTP app.
 * Tests talk HTTP via `app.request()` — no port, no mocks — so they exercise validation, authorization,
 * services, SQL, constraints and triggers together.
 */
export interface Harness {
  db: Database;
  driver: "pglite" | "postgres";
  call<T = any>(
    method: string,
    path: string,
    opts?: { body?: unknown; token?: string },
  ): Promise<{ status: number; headers: Headers; body: T }>;
  user(handle: string, role?: PersonRole): Promise<{ token: string; id: string; handle: string }>;
  idea(
    token: string,
    overrides?: Partial<{
      title: string;
      summary: string;
      topics: string[];
      tags: string[];
      sections: Record<string, string>;
    }>,
  ): Promise<IdeaDetail>;
  close(): Promise<void>;
}

/**
 * CONTRACT CHECK on every call made through the harness:
 *  - successful responses must match the response schema declared in the endpoint catalogue — exactly: the
 *    schema-parsed body must deep-equal the raw body, so undocumented extra fields fail as well as missing ones;
 *  - error responses must use the standard error envelope.
 * Calls to existing routes that are missing from the catalogue fail too (unknown paths still 404 normally).
 */
export function assertContract(method: string, fullPath: string, status: number, body: unknown) {
  const path = fullPath.split("?")[0]!;
  if (status >= 400) {
    const parsed = ErrorResponse.safeParse(body);
    if (!parsed.success)
      throw new Error(`${method} ${path} → ${status} without the error envelope: ${JSON.stringify(body)}`);
    return;
  }
  const match = matchEndpoint(method, path);
  if (!match) throw new Error(`${method} ${path} answered ${status} but is not in the endpoint catalogue.`);
  const [name, spec] = match;
  if (process.env.CONTRACT_COVERAGE_FILE)
    appendFileSync(
      process.env.CONTRACT_COVERAGE_FILE,
      `${name}
`,
    );
  const statuses = Array.isArray(spec.status) ? spec.status : [spec.status ?? 200];
  if (!statuses.includes(status)) {
    throw new Error(`${name}: status ${status} is not documented (expected ${statuses.join(" or ")}).`);
  }
  const parsed = spec.response.safeParse(body);
  if (!parsed.success) {
    throw new Error(`${name}: response does not match its contract:\n${parsed.error.message}`);
  }
  if (!isDeepStrictEqual(parsed.data, body)) {
    throw new Error(`${name}: response contains fields that are not in its contract.`);
  }
}

export async function createHarness(overrides: NodeJS.ProcessEnv = {}): Promise<Harness> {
  const testDb = await openTestDatabase();
  const database = testDb.handle;
  await ensureBaseTopics(database.db);
  const app = createApp({
    db: database.db,
    config: loadConfig({
      NODE_ENV: "test",
      SESSION_TTL_DAYS: "1",
      // The suite makes many requests from one "address"; rate limits get their own test.
      RATE_LIMIT_REQUESTS_PER_MINUTE: "0",
      RATE_LIMIT_AUTH_PER_MINUTE: "0",
      RATE_LIMIT_WRITES_PER_MINUTE: "0",
      ...overrides,
    }),
  });

  const call: Harness["call"] = async (method, path, opts = {}) => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const res = await app.request(`/v1${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    assertContract(method, `/v1${path}`, res.status, body);
    return { status: res.status, headers: res.headers, body };
  };

  let n = 0;
  return {
    db: database.db,
    driver: testDb.driver,
    call,
    async user(handle, role = "member") {
      const res = await call<AuthResponse>("POST", "/auth/register", {
        body: {
          handle,
          displayName: handle.replace(/-/g, " "),
          email: `${handle}@example.test`,
          password: "correct horse battery",
        },
      });
      if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
      if (role !== "member")
        await database.db.update(people).set({ role }).where(eq(people.id, res.body.person.id));
      return { token: res.body.token, id: res.body.person.id, handle };
    },
    async idea(token, overrides = {}) {
      n++;
      const res = await call<IdeaDetail>("POST", "/ideas", {
        token,
        body: {
          title: overrides.title ?? `Test idea number ${n}`,
          summary: overrides.summary ?? "A sufficiently long summary of a possible future for testing.",
          topics: overrides.topics ?? ["technology"],
          tags: overrides.tags ?? [],
          sections: overrides.sections ?? {},
        },
      });
      if (res.status !== 201) throw new Error(`idea failed: ${JSON.stringify(res.body)}`);
      return res.body;
    },
    close: () => testDb.dispose(),
  };
}
