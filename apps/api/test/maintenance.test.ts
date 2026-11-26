import { and, asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { activities, ideaMetrics, jobs, rateLimits, sessions, stances } from "../src/db/schema";
import { schedules } from "../src/modules/jobs/schedules";
import { queryRows } from "../src/db/client";
import { enqueue } from "../src/modules/jobs/queue";
import { drainJobs } from "../src/modules/jobs/runner";
import { inTransaction } from "../src/modules/shared/context";
import { takeStance } from "../src/modules/signals/service";
import { registry } from "../src/observability/metrics";
import { createHarness, type Harness } from "./harness";

let h: Harness;
let person: Awaited<ReturnType<Harness["user"]>>;
beforeAll(async () => {
  h = await createHarness({ METRICS_REFRESH_MODE: "async" });
  person = await h.user("maintenance");
});
afterAll(() => h.close());

async function run(kind: string, payload = {}) {
  const id = await enqueue(h.ctx, { kind, payload });
  await drainJobs(h.ctx);
  const [job] = await h.db.select().from(jobs).where(eq(jobs.id, id!));
  expect(job?.state, job?.lastError ?? kind).toBe("done");
}

it("commits or rolls back the stance, its activity and its coalesced refresh together", async () => {
  const idea = await h.idea(person.token);
  await drainJobs(h.ctx);
  const ctx = {
    ...h.ctx,
    actor: { id: person.id, role: "member" as const, active: true, trust: "new" as const },
  };
  const pending = () =>
    h.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.state, "pending"), eq(jobs.queue, "default")));
  const ledger = () =>
    h.db.select({ id: activities.id }).from(activities).where(eq(activities.action, "stance.taken"));
  await expect(
    inTransaction(ctx, async (tx) => {
      await takeStance(tx, idea.id, "important");
      expect(
        await tx.db
          .select()
          .from(jobs)
          .where(and(eq(jobs.state, "pending"), eq(jobs.queue, "default"))),
      ).toHaveLength(1);
      throw new Error("roll back stance");
    }),
  ).rejects.toThrow("roll back stance");
  expect(await pending()).toEqual([]);
  expect(await ledger()).toEqual([]);
  expect(await h.db.select().from(stances)).toEqual([]);

  await takeStance(ctx, idea.id, "important");
  await takeStance(ctx, idea.id, "plausible");
  expect(await ledger()).toHaveLength(2);
  expect(await pending()).toMatchObject([{ kind: "metrics.refresh", dedupeKey: idea.id }]);
  const detail = () => h.call("GET", "/ideas/" + idea.id);
  expect((await detail()).body.signals.attention).toBe(0);
  expect(await drainJobs(h.ctx)).toBe(1);
  expect((await detail()).body.signals.attention).toBe(1);
  const snapshot = () =>
    h.db.select().from(ideaMetrics).where(eq(ideaMetrics.ideaId, idea.id)).orderBy(asc(ideaMetrics.metric));
  const first = await snapshot();
  await run("metrics.refresh", { ideaId: idea.id });
  expect(await snapshot()).toEqual(first);
});

it("reconciles missing, obsolete and changed values once and preserves untouched timestamps", async () => {
  const idea = await h.idea(person.token);
  const drift = async () =>
    (await registry.getSingleMetric("metrics_reconcile_drift_total")!.get()).values[0]!.value;
  const initial = await drift();
  // Let reconciliation run before the pending refresh. Ordinary queue lag does not count as drift.
  await enqueue(h.ctx, { kind: "metrics.reconcile", payload: {}, priority: 1 });
  await drainJobs(h.ctx);
  expect(await drift()).toBe(initial);
  const snapshot = () =>
    h.db.select().from(ideaMetrics).where(eq(ideaMetrics.ideaId, idea.id)).orderBy(asc(ideaMetrics.metric));
  const before = await snapshot();
  await h.db.execute(
    sql`delete from idea_metrics where idea_metrics.idea_id = ${idea.id} and idea_metrics.metric = 'attention'`,
  );
  await h.db.execute(
    sql`update idea_metrics set algorithm = 'old' where idea_metrics.idea_id = ${idea.id} and idea_metrics.metric = 'contestation'`,
  );
  await h.db.insert(ideaMetrics).values({ ideaId: idea.id, metric: "obsolete", value: 1, algorithm: "old" });
  await run("metrics.reconcile");
  const repaired = await snapshot();
  expect(repaired.map(({ computedAt: _at, ...row }) => row)).toEqual(
    before.map(({ computedAt: _at, ...row }) => row),
  );
  expect(repaired.find((r) => r.metric === "completeness")).toEqual(
    before.find((r) => r.metric === "completeness"),
  );
  await run("metrics.reconcile");
  expect(await snapshot()).toEqual(repaired);
  expect(await drift()).toBe(initial + 1);
});

it("purges expired or revoked sessions in batches and retains recent sessions on redelivery", async () => {
  const old = new Date(Date.now() - 31 * 86400000);
  const future = new Date(Date.now() + 86400000);
  await h.db.insert(sessions).values([
    ...Array.from({ length: 501 }, (_, i) => ({
      personId: person.id,
      tokenHash: "expired-" + i,
      expiresAt: old,
    })),
    { personId: person.id, tokenHash: "old-revocation", expiresAt: future, revokedAt: old },
    { personId: person.id, tokenHash: "recent-revocation", expiresAt: future, revokedAt: new Date() },
    { personId: person.id, tokenHash: "recent-expiry", expiresAt: new Date() },
  ]);
  for (let i = 0; i < 2; i++) {
    await run("sessions.purge");
    const retained = await h.db.select({ hash: sessions.tokenHash }).from(sessions);
    expect(retained).toHaveLength(3); // Includes the live login session.
    expect(retained.map((r) => r.hash)).toEqual(
      expect.arrayContaining(["recent-expiry", "recent-revocation"]),
    );
  }
});

it("purges only rate-limit debt expired over a minute ago, including on redelivery", async () => {
  expect(schedules.find((s) => s.kind === "rate_limits.purge")?.every).toBe(60_000);
  expect(
    await queryRows(
      h.db,
      sql`select pg_class.relpersistence from pg_class where pg_class.oid = 'rate_limits'::regclass`,
    ),
  ).toEqual([{ relpersistence: "u" }]);
  await h.db.insert(rateLimits).values([
    { key: "expired", tat: sql`now() - interval '2 minutes'` },
    { key: "recent", tat: sql`now() - interval '5 seconds'` },
    { key: "live", tat: sql`now() + interval '1 hour'` },
  ]);
  for (let attempt = 0; attempt < 2; attempt++) {
    await run("rate_limits.purge");
    expect(await h.db.select({ key: rateLimits.key }).from(rateLimits).orderBy(rateLimits.key)).toEqual([
      { key: "live" },
      { key: "recent" },
    ]);
  }
});

it("applies both job retention windows on repeated scheduled deliveries", async () => {
  await h.db.insert(jobs).values([
    { kind: "old-done", state: "done", finishedAt: sql`now() - interval '8 days'` },
    { kind: "recent-done", state: "done", finishedAt: sql`now() - interval '6 days'` },
    { kind: "old-failed", state: "failed", finishedAt: sql`now() - interval '31 days'` },
    { kind: "recent-failed", state: "failed", finishedAt: sql`now() - interval '29 days'` },
  ]);
  for (let i = 0; i < 2; i++) {
    await run("jobs.purge");
    const kinds = (await h.db.select({ kind: jobs.kind }).from(jobs)).map((r) => r.kind);
    expect(kinds).toEqual(expect.arrayContaining(["recent-done", "recent-failed"]));
    expect(kinds).not.toContain("old-done");
    expect(kinds).not.toContain("old-failed");
  }
});
