import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { IdeaDetail } from "@ideaproxima/contracts";
import { queryRows } from "../src/db/client";
import { drainJobs } from "../src/modules/jobs/runner";
import { createHarness, type Harness } from "./harness";

/**
 * Races that only a real multi-connection Postgres can produce (run with `npm run test:pg`). On PGlite the same
 * tests pass trivially because it serialises everything — which is exactly why they must also run on Postgres.
 */
let h: Harness;
let users: Awaited<ReturnType<Harness["user"]>>[];

beforeAll(async () => {
  h = await createHarness();
  users = [];
  for (let i = 0; i < 8; i++) users.push(await h.user(`racer-${i}`));
});
afterAll(() => h.close());

const count = async (query: ReturnType<typeof sql>) => (await queryRows<{ n: number }>(h.db, query))[0]!.n;

describe("concurrency", () => {
  it("runs on the database the suite was configured for", () => {
    expect(h.driver).toBe(process.env.TEST_DATABASE_URL ? "postgres" : "pglite");
  });

  it("keeps idempotent PUTs idempotent under double submission", async () => {
    const idea = await h.idea(users[0]!.token);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        h.call("PUT", `/ideas/${idea.id}/stances/important`, { token: users[1]!.token }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));
    expect(
      await count(
        sql`select count(*)::int as n from stances where idea_id = ${idea.id} and retracted_at is null`,
      ),
    ).toBe(1);
  });

  it("never fails or loses votes when many people vote at once", async () => {
    const idea = await h.idea(users[0]!.token);
    const results = await Promise.all(
      users.map((u) => h.call("PUT", `/ideas/${idea.id}/stances/important`, { token: u.token })),
    );
    expect(results.map((r) => r.status)).toEqual(Array(users.length).fill(200));
    await drainJobs(h.ctx);
    const detail = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
    expect(detail.body.signals.attention).toBe(users.length);
  });

  it("keeps derived ratings consistent when many people evaluate at once", async () => {
    const idea = await h.idea(users[0]!.token);
    const results = await Promise.all(
      users.map((u, i) =>
        h.call("POST", "/evaluations", {
          token: u.token,
          body: {
            target: { kind: "idea", id: idea.id },
            ratings: [{ dimension: "impact", value: (i % 5) + 1 }],
          },
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(users.length).fill(200));
    await drainJobs(h.ctx);
    const detail = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
    expect(detail.body.signals.ratings.impact?.n).toBe(users.length);
    expect(detail.body.signals.counts.evaluators).toBe(users.length);
  });

  it("records exactly one current rating per dimension under double submission", async () => {
    const idea = await h.idea(users[0]!.token);
    const results = await Promise.all(
      [3, 4, 5, 2].map((value) =>
        h.call("POST", "/evaluations", {
          token: users[2]!.token,
          body: { target: { kind: "idea", id: idea.id }, ratings: [{ dimension: "feasibility", value }] },
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(
      await count(
        sql`select count(*)::int as n from evaluations where idea_id = ${idea.id} and superseded_at is null`,
      ),
    ).toBe(1);
  });

  it("lets exactly one of several concurrent publishes on the same base win", async () => {
    const idea = await h.idea(users[0]!.token);
    const results = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        h.call("POST", `/ideas/${idea.id}/revisions`, {
          token: users[0]!.token,
          body: {
            baseRevisionId: idea.revision.id,
            changeNote: `Concurrent edit ${i}`,
            content: {
              title: idea.title,
              summary: `A concurrently edited summary, version ${i}.`,
              topics: ["technology"],
            },
          },
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    const numbers = await queryRows<{ number: number }>(
      h.db,
      sql`select number from idea_revisions where idea_id = ${idea.id} order by number`,
    );
    expect(numbers.map((r) => r.number)).toEqual([1, 2]);
  });

  it("keeps 'find or create' source registration idempotent under concurrency", async () => {
    const results = await Promise.all(
      users.slice(0, 4).map((u) =>
        h.call("POST", "/sources", {
          token: u.token,
          body: { kind: "report", title: "Illustrative concurrent source", doi: "10.5555/RACE.1" },
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 201]);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
  });

  it("gives ideas proposed at the same moment with the same title distinct slugs", async () => {
    const results = await Promise.all(
      users.slice(0, 4).map((u) =>
        h.call("POST", "/ideas", {
          token: u.token,
          body: {
            title: "Simultaneous idea",
            summary: "Four people propose this at exactly the same time.",
            topics: ["science"],
          },
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    expect(results.map((r) => r.body.slug).sort()).toEqual([
      "simultaneous-idea",
      "simultaneous-idea-2",
      "simultaneous-idea-3",
      "simultaneous-idea-4",
    ]);
  });

  it("keeps involvement declarations single under double submission", async () => {
    const idea = await h.idea(users[0]!.token);
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        h.call("PUT", `/ideas/${idea.id}/involvements/research`, {
          token: users[3]!.token,
          body: { status: "active" },
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(
      await count(
        sql`select count(*)::int as n from involvements where idea_id = ${idea.id} and superseded_at is null`,
      ),
    ).toBe(1);
  });
});
