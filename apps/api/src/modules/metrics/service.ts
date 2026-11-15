/**
 * METRICS — the only module allowed to write derived values.
 *
 * Reads raw facts (evaluations, stances, revisions, knowledge counts), runs the provisional baseline algorithm
 * from @ideaproxima/domain with the configured WeightPolicy, and materialises the results in `idea_metrics`.
 * `refreshIdeaMetrics` is called synchronously after every write that affects an idea's signals; at larger scale
 * it can move to a queue without changing any caller (see docs/agents/architecture.md, "Scaling notes").
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { IdeaSignals } from "@ideaproxima/contracts";
import {
  BASELINE_ALGORITHM,
  DIMENSIONS,
  STANCE_KINDS,
  contestation,
  dimensionsFor,
  isDimensionKey,
  perspectiveShares,
  sectionCompleteness,
  summarizeRatings,
  type DimensionKey,
  type RatingSummary,
  type StanceKind,
} from "@ideaproxima/domain";
import { queryRows, type Database } from "../../db/client";
import { evaluations, ideaMetrics, ideaRevisions, ideas, ideaTopics, stances } from "../../db/schema";
import { KNOWLEDGE_ACTIONS } from "../shared/activity";
import { inTransaction, type Ctx } from "../shared/context";
import { lockKeys } from "../shared/locks";

const COUNT_KEYS = [
  "claims",
  "evidence",
  "evidenceSupporting",
  "evidenceChallenging",
  "arguments",
  "comments",
  "initiatives",
  "contributors",
  "evaluators",
] as const;
type CountKey = (typeof COUNT_KEYS)[number];

type MetricRow = typeof ideaMetrics.$inferInsert;

const scaleOf = (d: DimensionKey) => {
  const s = DIMENSIONS[d].scale;
  return s.kind === "ordinal" ? { min: s.min, max: s.max } : { min: 0, max: 1 };
};

/** Summaries of current ratings, per target and ordinal dimension, under the context's weight policy. */
export async function summarizeTargets(
  ctx: Ctx,
  targetIds: readonly string[],
  dimensions: readonly DimensionKey[],
): Promise<Map<string, Partial<Record<DimensionKey, RatingSummary>>>> {
  const out = new Map<string, Partial<Record<DimensionKey, RatingSummary>>>();
  if (!targetIds.length || !dimensions.length) return out;
  const rows = await ctx.db
    .select({
      targetId: evaluations.targetId,
      evaluatorId: evaluations.evaluatorId,
      dimension: evaluations.dimension,
      value: evaluations.value,
    })
    .from(evaluations)
    .where(
      and(
        inArray(evaluations.targetId, [...targetIds]),
        inArray(evaluations.dimension, [...dimensions]),
        isNull(evaluations.supersededAt),
      ),
    );
  const grouped = new Map<string, Map<DimensionKey, { value: number; weight: number }[]>>();
  for (const r of rows) {
    if (!r.targetId || !isDimensionKey(r.dimension)) continue;
    const byDim = grouped.get(r.targetId) ?? new Map();
    const list = byDim.get(r.dimension) ?? [];
    list.push({
      value: r.value,
      weight: ctx.weights({ evaluatorId: r.evaluatorId, dimension: r.dimension, topicIds: [] }),
    });
    byDim.set(r.dimension, list);
    grouped.set(r.targetId, byDim);
  }
  for (const [targetId, byDim] of grouped) {
    const summaries: Partial<Record<DimensionKey, RatingSummary>> = {};
    for (const [dim, obs] of byDim) {
      const s = summarizeRatings(obs, scaleOf(dim));
      if (s) summaries[dim] = s;
    }
    out.set(targetId, summaries);
  }
  return out;
}

/** Number of current "useful" marks per target (binary dimension, so a count is the honest summary). */
export async function usefulCounts(db: Database, targetIds: readonly string[]): Promise<Map<string, number>> {
  if (!targetIds.length) return new Map();
  const rows = await db
    .select({ targetId: evaluations.targetId, n: sql<number>`count(*)::int` })
    .from(evaluations)
    .where(
      and(
        inArray(evaluations.targetId, [...targetIds]),
        eq(evaluations.dimension, "useful"),
        isNull(evaluations.supersededAt),
      ),
    )
    .groupBy(evaluations.targetId);
  return new Map(rows.filter((r) => r.targetId).map((r) => [r.targetId!, r.n]));
}

/** Recomputes and materialises every derived metric of the given ideas. Idempotent. */
export async function refreshIdeaMetrics(ctx: Ctx, ideaIds: readonly string[]): Promise<void> {
  const ids = [...new Set(ideaIds)].sort();
  if (!ids.length) return;
  // Serialise refreshes per idea. A refresh then reads every fact committed by concurrent writers that refreshed
  // before it (READ COMMITTED takes a new snapshot per statement), so the last refresh always sees everything,
  // and two refreshes can never interleave their delete/insert of the same rows.
  await inTransaction(ctx, async (tx) => {
    await lockKeys(
      tx,
      ids.map((id) => `metrics:${id}`),
    );
    await computeAndStoreMetrics(tx, ids);
  });
}

async function computeAndStoreMetrics(ctx: Ctx, ids: string[]): Promise<void> {
  const db = ctx.db;

  const [topicRows, evalRows, stanceRows, revisionRows, countRows] = await Promise.all([
    db
      .select({ ideaId: ideaTopics.ideaId, topicId: ideaTopics.topicId })
      .from(ideaTopics)
      .where(inArray(ideaTopics.ideaId, ids)),
    db
      .select({
        ideaId: evaluations.ideaId,
        evaluatorId: evaluations.evaluatorId,
        dimension: evaluations.dimension,
        value: evaluations.value,
      })
      .from(evaluations)
      .where(and(inArray(evaluations.ideaId, ids), isNull(evaluations.supersededAt))),
    db
      .select({ ideaId: stances.ideaId, personId: stances.personId, kind: stances.kind })
      .from(stances)
      .where(and(inArray(stances.ideaId, ids), isNull(stances.retractedAt))),
    db
      .select({ ideaId: ideas.id, content: ideaRevisions.content })
      .from(ideas)
      .innerJoin(ideaRevisions, eq(ideaRevisions.id, ideas.currentRevisionId))
      .where(inArray(ideas.id, ids)),
    queryRows<Record<CountKey, number> & { idea_id: string }>(
      db,
      sql`
        select i.id as idea_id,
          (select count(*) from idea_claims ic join claims c on c.id = ic.claim_id
             where ic.idea_id = i.id and ic.removed_at is null and c.hidden_at is null)::int as "claims",
          (select count(*) from evidence e where e.withdrawn_at is null and e.hidden_at is null
             and e.claim_id in (select ic.claim_id from idea_claims ic where ic.idea_id = i.id and ic.removed_at is null))::int as "evidence",
          (select count(*) from evidence e where e.withdrawn_at is null and e.hidden_at is null and e.stance = 'supports'
             and e.claim_id in (select ic.claim_id from idea_claims ic where ic.idea_id = i.id and ic.removed_at is null))::int as "evidenceSupporting",
          (select count(*) from evidence e where e.withdrawn_at is null and e.hidden_at is null and e.stance = 'challenges'
             and e.claim_id in (select ic.claim_id from idea_claims ic where ic.idea_id = i.id and ic.removed_at is null))::int as "evidenceChallenging",
          (select count(*) from arguments a where a.idea_id = i.id and a.withdrawn_at is null and a.hidden_at is null)::int as "arguments",
          (select count(*) from comments cm where cm.idea_id = i.id and cm.hidden_at is null)::int as "comments",
          (select count(*) from initiatives n where n.idea_id = i.id and n.hidden_at is null)::int as "initiatives",
          (select count(distinct a.actor_id) from activities a
             where i.id = any(a.idea_ids) and a.actor_id is not null
               and a.action in (${sql.raw(KNOWLEDGE_ACTIONS.map((x) => `'${x}'`).join(", "))}))::int as "contributors",
          (select count(distinct ev.evaluator_id) from evaluations ev where ev.idea_id = i.id and ev.superseded_at is null)::int as "evaluators"
        from ideas i where i.id in ${ids}
      `,
    ),
  ]);

  const topicsByIdea = groupBy(
    topicRows,
    (r) => r.ideaId,
    (r) => r.topicId,
  );
  const evalsByIdea = groupBy(
    evalRows,
    (r) => r.ideaId!,
    (r) => r,
  );
  const stancesByIdea = groupBy(
    stanceRows,
    (r) => r.ideaId,
    (r) => r,
  );
  const contentByIdea = new Map(revisionRows.map((r) => [r.ideaId, r.content]));
  const countsByIdea = new Map(countRows.map((r) => [r.idea_id, r]));

  const rows: MetricRow[] = [];
  const now = new Date();
  for (const ideaId of ids) {
    const push = (metric: string, value: number, extra: Partial<MetricRow> = {}) =>
      rows.push({ ideaId, metric, value, algorithm: BASELINE_ALGORITHM, computedAt: now, ...extra });

    // Ratings: one summary per idea dimension, weighted by the configured policy.
    const topicIds = topicsByIdea.get(ideaId) ?? [];
    const summaries: RatingSummary[] = [];
    for (const dim of dimensionsFor("idea")) {
      const obs = (evalsByIdea.get(ideaId) ?? [])
        .filter((e) => e.dimension === dim)
        .map((e) => ({
          value: e.value,
          weight: ctx.weights({ evaluatorId: e.evaluatorId, dimension: dim, topicIds }),
        }));
      const s = summarizeRatings(obs, scaleOf(dim));
      if (!s) continue;
      summaries.push(s);
      push(`rating.${dim}`, s.normalizedMean, {
        sampleSize: s.n,
        dispersion: s.normalizedSd,
        details: { mean: s.mean, sd: s.sd, weightSum: s.weightSum },
      });
    }
    push("contestation", contestation(summaries));

    // Stances: attention (popularity) and perspective shares. Never mixed into the ratings above.
    const ideaStances = stancesByIdea.get(ideaId) ?? [];
    const holders = new Set(ideaStances.map((s) => s.personId)).size;
    const counts: Partial<Record<StanceKind, number>> = {};
    for (const s of ideaStances) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    push("attention", counts.important ?? 0, { sampleSize: counts.important ?? 0 });
    const shares = perspectiveShares(counts, holders);
    for (const kind of STANCE_KINDS) {
      push(`perspective.${kind}`, shares[kind].share, {
        sampleSize: holders,
        details: { count: shares[kind].count },
      });
    }

    // Development.
    const content = contentByIdea.get(ideaId);
    push("completeness", content ? sectionCompleteness(content.sections) : 0);

    // Plain counts.
    const c = countsByIdea.get(ideaId);
    for (const key of COUNT_KEYS) push(`count.${key}`, c?.[key] ?? 0);
  }

  await db.delete(ideaMetrics).where(inArray(ideaMetrics.ideaId, ids));
  if (rows.length) await db.insert(ideaMetrics).values(rows);
}

/** Recomputes metrics for every idea. Proves (and restores) the derivability of all derived data. */
export async function rebuildAllIdeaMetrics(ctx: Ctx, batchSize = 200): Promise<number> {
  const all = await ctx.db.select({ id: ideas.id }).from(ideas);
  for (let i = 0; i < all.length; i += batchSize) {
    await refreshIdeaMetrics(
      ctx,
      all.slice(i, i + batchSize).map((r) => r.id),
    );
  }
  return all.length;
}

export function emptySignals(): IdeaSignals {
  return {
    algorithm: BASELINE_ALGORITHM,
    computedAt: null,
    attention: 0,
    ratings: {},
    perspectives: perspectiveShares({}, 0),
    completeness: 0,
    contestation: 0,
    counts: Object.fromEntries(COUNT_KEYS.map((k) => [k, 0])) as IdeaSignals["counts"],
  };
}

/** Assembles the `signals` block of idea DTOs from materialised metrics. */
export async function loadSignals(
  db: Database,
  ideaIds: readonly string[],
): Promise<Map<string, IdeaSignals>> {
  const out = new Map<string, IdeaSignals>();
  if (!ideaIds.length) return out;
  const rows = await db
    .select()
    .from(ideaMetrics)
    .where(inArray(ideaMetrics.ideaId, [...ideaIds]));
  for (const r of rows) {
    const s = out.get(r.ideaId) ?? emptySignals();
    s.algorithm = r.algorithm;
    const computed = r.computedAt.toISOString();
    if (!s.computedAt || computed > s.computedAt) s.computedAt = computed;
    const [head, tail] = splitKey(r.metric);
    if (head === "rating" && tail && isDimensionKey(tail)) {
      s.ratings[tail] = {
        value: r.value,
        mean: Number((r.details as { mean?: number } | null)?.mean ?? 0),
        dispersion: r.dispersion ?? 0,
        n: r.sampleSize,
      };
    } else if (head === "perspective" && tail && (STANCE_KINDS as readonly string[]).includes(tail)) {
      s.perspectives[tail as StanceKind] = {
        share: r.value,
        count: Number((r.details as { count?: number } | null)?.count ?? 0),
      };
    } else if (head === "count" && tail && (COUNT_KEYS as readonly string[]).includes(tail)) {
      s.counts[tail as CountKey] = r.value;
    } else if (r.metric === "attention") s.attention = r.value;
    else if (r.metric === "completeness") s.completeness = r.value;
    else if (r.metric === "contestation") s.contestation = r.value;
    out.set(r.ideaId, s);
  }
  return out;
}

const splitKey = (metric: string): [string, string | undefined] => {
  const dot = metric.indexOf(".");
  return dot < 0 ? [metric, undefined] : [metric.slice(0, dot), metric.slice(dot + 1)];
};

function groupBy<T, V>(rows: readonly T[], key: (r: T) => string, value: (r: T) => V): Map<string, V[]> {
  const m = new Map<string, V[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k) ?? [];
    list.push(value(r));
    m.set(k, list);
  }
  return m;
}
