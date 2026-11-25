import { and, asc, count, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type {
  IdeaDetail,
  IdeaListItem,
  ListIdeasQuery,
  Page,
  RevisionDto,
  StageTransitionDto,
} from "@ideaproxima/contracts";
import {
  IMPLEMENTING_INITIATIVE_KINDS,
  TESTING_INITIATIVE_KINDS,
  isDimensionKey,
  normalizeTag,
  notFound,
  stageRequirements,
  type StageEvidenceFacts,
} from "@ideaproxima/domain";
import { queryRows, type Database } from "../../db/client";
import {
  evaluations,
  ideaRevisions,
  ideaStewards,
  ideas,
  involvements,
  stageTransitions,
  stances,
} from "../../db/schema";
import { emptySignals, loadSignals } from "../metrics/service";
import { isModerator, type Ctx } from "../shared/context";
import { encodeCursor, offsetFrom, splitPage } from "../shared/pagination";
import { iso, isoOrNull, personRefs, refOrUnknown, topicRefsByIdea } from "../shared/refs";
import { isUuid } from "../../lib/ids";

export type IdeaRow = typeof ideas.$inferSelect;

/** Finds an idea by id or slug. Hidden ideas are invisible except to moderators. */
export async function findIdea(ctx: Ctx, ref: string): Promise<IdeaRow> {
  const where = isUuid(ref) ? eq(ideas.id, ref) : eq(ideas.slug, ref.toLowerCase());
  const [idea] = await ctx.db.select().from(ideas).where(where).limit(1);
  if (!idea || (idea.hiddenAt && !isModerator(ctx))) throw notFound("idea_not_found");
  return idea;
}

/**
 * Locks the idea row for the rest of the transaction: serialises revision and stage writes per idea.
 * FOR NO KEY UPDATE (not FOR UPDATE) so it does not block concurrent inserts that merely reference the idea
 * (stances, evaluations, comments take FOR KEY SHARE on it through their foreign keys).
 */
export async function lockIdea(ctx: Ctx, ideaId: string): Promise<IdeaRow> {
  const [idea] = await ctx.db.select().from(ideas).where(eq(ideas.id, ideaId)).for("no key update");
  if (!idea || (idea.hiddenAt && !isModerator(ctx))) throw notFound("idea_not_found");
  return idea;
}

export async function currentStewardIds(db: Database, ideaId: string): Promise<string[]> {
  const rows = await db
    .select({ personId: ideaStewards.personId })
    .from(ideaStewards)
    .where(and(eq(ideaStewards.ideaId, ideaId), isNull(ideaStewards.revokedAt)));
  return rows.map((r) => r.personId);
}

export async function isSteward(ctx: Ctx, ideaId: string): Promise<boolean> {
  if (!ctx.actor) return false;
  return (await currentStewardIds(ctx.db, ideaId)).includes(ctx.actor.id);
}

/** Hydrates list items for the given idea ids, preserving the given order and skipping hidden ideas. */
export async function listIdeaItems(ctx: Ctx, ids: readonly string[]): Promise<IdeaListItem[]> {
  if (!ids.length) return [];
  const rows = await ctx.db
    .select()
    .from(ideas)
    .where(
      isModerator(ctx)
        ? inArray(ideas.id, [...ids])
        : and(inArray(ideas.id, [...ids]), isNull(ideas.hiddenAt)),
    );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const [people, topicMap, signals] = await Promise.all([
    personRefs(
      ctx.db,
      rows.map((r) => r.proposedBy),
    ),
    topicRefsByIdea(
      ctx.db,
      rows.map((r) => r.id),
    ),
    loadSignals(
      ctx.db,
      rows.map((r) => r.id),
    ),
  ]);
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is IdeaRow => !!r)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      stage: r.stage,
      stageChangedAt: iso(r.stageChangedAt),
      topics: topicMap.get(r.id) ?? [],
      tags: r.tags,
      proposedBy: refOrUnknown(people, r.proposedBy),
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
      signals: signals.get(r.id) ?? emptySignals(),
    }));
}

// ---------------------------------------------------------------- lenses

interface LensPlan {
  joins: SQL[];
  where: SQL[];
  order: SQL;
}

const metricJoin = (alias: string, metric: string) =>
  sql`left join idea_metrics ${sql.raw(alias)} on ${sql.raw(alias)}.idea_id = i.id and ${sql.raw(alias)}.metric = ${metric}`;

/** Threshold for "high potential" in the neglected lens: normalised impact ≥ 0.6 (mean ≥ 3.4 on 1–5). */
const NEGLECTED_MIN_IMPACT = 0.6;

/**
 * Lens implementations. Each one is a transparent, documented query over derived metrics — the meaning of each
 * lens is defined in @ideaproxima/domain (LENS_INFO) and must stay honest about what it measures.
 */
function lensPlan(lens: ListIdeasQuery["lens"]): LensPlan {
  switch (lens) {
    case "newest":
      return { joins: [], where: [], order: sql`i.created_at desc` };
    case "attention":
      return {
        joins: [metricJoin("m", "attention")],
        where: [],
        order: sql`coalesce(m.value, 0) desc, i.created_at desc`,
      };
    case "emerging":
      return {
        joins: [
          sql`left join lateral (select count(*)::int as n from stances s where s.idea_id = i.id and s.kind = 'important'
                and s.retracted_at is null and s.created_at > now() - interval '30 days') g on true`,
          metricJoin("m", "attention"),
        ],
        where: [],
        order: sql`g.n desc, coalesce(m.value, 0) desc, i.created_at desc`,
      };
    case "evidence":
      return {
        joins: [metricJoin("m", "rating.evidence")],
        where: [sql`m.value is not null`],
        order: sql`m.value desc, m.sample_size desc`,
      };
    case "potential":
      return {
        joins: [metricJoin("m", "rating.impact")],
        where: [sql`m.value is not null`],
        order: sql`m.value desc, m.sample_size desc`,
      };
    case "feasible":
      return {
        joins: [metricJoin("m", "rating.feasibility")],
        where: [sql`m.value is not null`],
        order: sql`m.value desc, m.sample_size desc`,
      };
    case "developed":
      return {
        joins: [metricJoin("m", "completeness"), metricJoin("m2", "count.claims")],
        where: [],
        order: sql`coalesce(m.value, 0) desc, coalesce(m2.value, 0) desc, i.created_at desc`,
      };
    case "neglected":
      // High potential AND at-or-below-median attention: the well-attended are excluded, not merely sorted last.
      return {
        joins: [metricJoin("m", "rating.impact"), metricJoin("m2", "attention")],
        where: [
          sql`m.value >= ${NEGLECTED_MIN_IMPACT}`,
          sql`coalesce(m2.value, 0) <= (
            select percentile_cont(0.5) within group (order by coalesce(x.value, 0))
            from ideas i2 left join idea_metrics x on x.idea_id = i2.id and x.metric = 'attention'
            where i2.hidden_at is null)`,
        ],
        order: sql`coalesce(m2.value, 0) asc, m.value desc`,
      };
    case "contested":
      return {
        joins: [metricJoin("m", "contestation")],
        where: [sql`m.value > 0`],
        order: sql`m.value desc`,
      };
    case "needs_review":
      return {
        joins: [metricJoin("m", "count.evaluators")],
        where: [sql`coalesce(m.value, 0) < 3`],
        order: sql`coalesce(m.value, 0) asc, i.created_at desc`,
      };
    case "in_practice":
      return {
        joins: [],
        where: [sql`i.stage in ('tested', 'implemented', 'learned_from')`],
        order: sql`i.stage_changed_at desc`,
      };
  }
}

export async function listIdeas(ctx: Ctx, query: ListIdeasQuery): Promise<Page<IdeaListItem>> {
  const plan = lensPlan(query.lens);
  const where: SQL[] = [sql`i.hidden_at is null`, ...plan.where];
  if (query.topic) {
    where.push(sql`exists (select 1 from idea_topics it join topics t on t.id = it.topic_id
      where it.idea_id = i.id and (t.slug = ${query.topic} or t.parent_id = (select id from topics where slug = ${query.topic})))`);
  }
  if (query.stage) where.push(sql`i.stage = ${query.stage}`);
  if (query.tag) where.push(sql`${normalizeTag(query.tag)} = any(i.tags)`);
  if (query.q) where.push(sql`i.search @@ websearch_to_tsquery('english', ${query.q})`);

  const offset = offsetFrom(query.cursor);
  const rows = await queryRows<{ id: string }>(
    ctx.db,
    sql`select i.id from ideas i ${sql.join(plan.joins, sql` `)}
        where ${sql.join(where, sql` and `)}
        order by ${plan.order}, i.id desc
        limit ${query.limit + 1} offset ${offset}`,
  );
  const { items, hasMore } = splitPage(rows, query.limit);
  return {
    items: await listIdeaItems(
      ctx,
      items.map((r) => r.id),
    ),
    nextCursor: hasMore ? encodeCursor({ o: offset + query.limit }) : null,
  };
}

// ---------------------------------------------------------------- detail

export async function gatherStageFacts(db: Database, ideaId: string): Promise<StageEvidenceFacts> {
  const list = (xs: readonly string[]) => sql.raw(xs.map((x) => `'${x}'`).join(", "));
  const [facts] = await queryRows<StageEvidenceFacts>(
    db,
    sql`
      with stewards as (select person_id from idea_stewards where idea_id = ${ideaId} and revoked_at is null)
      select
        (select count(distinct p) from (
           select evaluator_id as p from evaluations where idea_id = ${ideaId}
           union select author_id from arguments where idea_id = ${ideaId} and hidden_at is null
         ) x where p not in (select person_id from stewards))::int as "independentReviewers",
        (select count(*) from initiatives n where n.idea_id = ${ideaId} and n.hidden_at is null
           and n.kind in (${list(TESTING_INITIATIVE_KINDS)})
           and exists (select 1 from outcomes o where o.initiative_id = n.id))::int as "testsWithOutcomes",
        (select count(*) from initiatives n where n.idea_id = ${ideaId} and n.hidden_at is null
           and n.kind in (${list(IMPLEMENTING_INITIATIVE_KINDS)}) and n.status in ('active', 'completed'))::int as "implementations",
        (select count(*) from outcomes o join initiatives n on n.id = o.initiative_id
           where n.idea_id = ${ideaId} and n.hidden_at is null and length(trim(o.lessons)) > 0)::int as "outcomesWithLessons"
    `,
  );
  return facts!;
}

export async function getIdeaDetail(ctx: Ctx, ref: string): Promise<IdeaDetail> {
  const idea = await findIdea(ctx, ref);
  const [[item], [revision], stewardRows, facts, [pending]] = await Promise.all([
    listIdeaItems(ctx, [idea.id]),
    ctx.db.select().from(ideaRevisions).where(eq(ideaRevisions.id, idea.currentRevisionId!)),
    ctx.db
      .select()
      .from(ideaStewards)
      .where(and(eq(ideaStewards.ideaId, idea.id), isNull(ideaStewards.revokedAt)))
      .orderBy(asc(ideaStewards.grantedAt)),
    gatherStageFacts(ctx.db, idea.id),
    ctx.db
      .select({ n: count() })
      .from(ideaRevisions)
      .where(and(eq(ideaRevisions.ideaId, idea.id), eq(ideaRevisions.status, "proposed"))),
  ]);
  const refs = await personRefs(ctx.db, [revision!.authorId, ...stewardRows.map((s) => s.personId)]);
  const stewardIds = stewardRows.map((s) => s.personId);

  let viewer: IdeaDetail["viewer"] = null;
  if (ctx.actor) {
    const actorId = ctx.actor.id;
    const [myStances, myRatings, myInvolvements] = await Promise.all([
      ctx.db
        .select({ kind: stances.kind })
        .from(stances)
        .where(and(eq(stances.ideaId, idea.id), eq(stances.personId, actorId), isNull(stances.retractedAt))),
      ctx.db
        .select({
          dimension: evaluations.dimension,
          value: evaluations.value,
          confidence: evaluations.confidence,
        })
        .from(evaluations)
        .where(
          and(
            eq(evaluations.ideaId, idea.id),
            eq(evaluations.evaluatorId, actorId),
            isNull(evaluations.supersededAt),
          ),
        ),
      ctx.db
        .select({ capacity: involvements.capacity, status: involvements.status })
        .from(involvements)
        .where(
          and(
            eq(involvements.ideaId, idea.id),
            eq(involvements.personId, actorId),
            isNull(involvements.supersededAt),
          ),
        ),
    ]);
    viewer = {
      isSteward: stewardIds.includes(actorId),
      stances: myStances.map((s) => s.kind),
      ratings: myRatings.flatMap((r) =>
        isDimensionKey(r.dimension) ? [{ ...r, dimension: r.dimension }] : [],
      ),
      involvements: myInvolvements,
    };
  }

  return {
    ...item!,
    revision: {
      id: revision!.id,
      number: revision!.number,
      author: refOrUnknown(refs, revision!.authorId),
      createdAt: iso(revision!.decidedAt ?? revision!.createdAt),
      changeNote: revision!.changeNote,
    },
    sections: revision!.content.sections,
    stewards: stewardRows.map((s) => ({
      person: refOrUnknown(refs, s.personId),
      role: s.role,
      since: iso(s.grantedAt),
    })),
    hidden: !!idea.hiddenAt,
    stageRequirements: stageRequirements(facts),
    pendingRevisionProposals: pending?.n ?? 0,
    viewer,
  };
}

// ---------------------------------------------------------------- history

type RevisionRow = typeof ideaRevisions.$inferSelect;

export async function revisionDtos(db: Database, rows: RevisionRow[]): Promise<RevisionDto[]> {
  const refs = await personRefs(
    db,
    rows.flatMap((r) => [r.authorId, r.decidedBy]),
  );
  return rows.map((r) => ({
    id: r.id,
    ideaId: r.ideaId,
    number: r.number,
    status: r.status,
    author: refOrUnknown(refs, r.authorId),
    baseRevisionId: r.baseRevisionId,
    changeNote: r.changeNote,
    createdAt: iso(r.createdAt),
    decidedBy: r.decidedBy ? refOrUnknown(refs, r.decidedBy) : null,
    decidedAt: isoOrNull(r.decidedAt),
    decisionNote: r.decisionNote,
    content: r.content,
  }));
}

export async function listRevisions(
  ctx: Ctx,
  ideaRef: string,
  status?: string,
): Promise<Omit<RevisionDto, "content">[]> {
  const idea = await findIdea(ctx, ideaRef);
  const rows = await ctx.db
    .select()
    .from(ideaRevisions)
    .where(
      status
        ? and(eq(ideaRevisions.ideaId, idea.id), eq(ideaRevisions.status, status as RevisionRow["status"]))
        : eq(ideaRevisions.ideaId, idea.id),
    )
    .orderBy(desc(ideaRevisions.number));
  return (await revisionDtos(ctx.db, rows)).map(({ content: _content, ...rest }) => rest);
}

export async function getRevision(ctx: Ctx, ideaRef: string, revisionId: string): Promise<RevisionDto> {
  const idea = await findIdea(ctx, ideaRef);
  const [row] = await ctx.db
    .select()
    .from(ideaRevisions)
    .where(and(eq(ideaRevisions.ideaId, idea.id), eq(ideaRevisions.id, revisionId)));
  if (!row) throw notFound("revision_not_found");
  return (await revisionDtos(ctx.db, [row]))[0]!;
}

export async function listStageHistory(ctx: Ctx, ideaRef: string): Promise<StageTransitionDto[]> {
  const idea = await findIdea(ctx, ideaRef);
  const rows = await ctx.db
    .select()
    .from(stageTransitions)
    .where(eq(stageTransitions.ideaId, idea.id))
    .orderBy(asc(stageTransitions.occurredAt), asc(stageTransitions.id));
  const refs = await personRefs(
    ctx.db,
    rows.map((r) => r.decidedBy),
  );
  return rows.map((r) => stageTransitionDto(r, refs));
}

export const stageTransitionDto = (
  r: typeof stageTransitions.$inferSelect,
  refs: Awaited<ReturnType<typeof personRefs>>,
): StageTransitionDto => ({
  id: r.id,
  from: r.fromStage,
  to: r.toStage,
  rationale: r.rationale,
  decidedBy: refOrUnknown(refs, r.decidedBy),
  occurredAt: iso(r.occurredAt),
  initiativeId: r.initiativeId,
});
