import { and, eq, isNull, or, sql } from "drizzle-orm";
import type {
  GraphDto,
  GraphQuery,
  IdeaRelationView,
  ProposeRelationRequest,
  RelationDto,
} from "@ideaproxima/contracts";
import {
  BASELINE_ALGORITHM,
  BUILDS_ON_RELATION_TYPES,
  DomainError,
  authorize,
  describeRelationFrom,
  normalizeRelation,
  notFound,
} from "@ideaproxima/domain";
import { queryRows } from "../../db/client";
import { ideaRelations } from "../../db/schema";
import { currentStewardIds, findIdea } from "../ideas/queries";
import { summarizeTargets } from "../metrics/service";
import { recordActivity } from "../shared/activity";
import { inTransaction, type Ctx } from "../shared/context";
import { ideaRefs, iso, personRefs, ratingDto, refOrUnknown, topicRefsByIdea } from "../shared/refs";

type RelationRow = typeof ideaRelations.$inferSelect;

async function relationDtos(ctx: Ctx, rows: RelationRow[]): Promise<RelationDto[]> {
  const [ideasMap, refs, summaries] = await Promise.all([
    ideaRefs(
      ctx.db,
      rows.flatMap((r) => [r.fromIdeaId, r.toIdeaId]),
    ),
    personRefs(
      ctx.db,
      rows.map((r) => r.proposedBy),
    ),
    summarizeTargets(
      ctx,
      rows.map((r) => r.id),
      ["validity"],
    ),
  ]);
  // Relations touching a hidden idea are omitted: they would leak its existence.
  return rows
    .filter((r) => ideasMap.has(r.fromIdeaId) && ideasMap.has(r.toIdeaId))
    .map((r) => ({
      id: r.id,
      type: r.type,
      from: ideasMap.get(r.fromIdeaId)!,
      to: ideasMap.get(r.toIdeaId)!,
      rationale: r.rationale,
      proposedBy: refOrUnknown(refs, r.proposedBy),
      createdAt: iso(r.createdAt),
      derived: { algorithm: BASELINE_ALGORITHM, validity: ratingDto(summaries.get(r.id)?.validity) },
    }));
}

export async function proposeRelation(ctx: Ctx, input: ProposeRelationRequest): Promise<RelationDto> {
  authorize(ctx.actor, "knowledge.contribute");
  const edge = normalizeRelation(input);
  const row = await inTransaction(ctx, async (tx) => {
    await findIdea(tx, edge.fromIdeaId);
    await findIdea(tx, edge.toIdeaId);
    const [dup] = await tx.db
      .select({ id: ideaRelations.id })
      .from(ideaRelations)
      .where(
        and(
          eq(ideaRelations.fromIdeaId, edge.fromIdeaId),
          eq(ideaRelations.toIdeaId, edge.toIdeaId),
          eq(ideaRelations.type, edge.type),
          isNull(ideaRelations.retractedAt),
        ),
      );
    if (dup) throw new DomainError("conflict", "relation_exists");
    const [created] = await tx.db
      .insert(ideaRelations)
      .values({ ...edge, rationale: input.rationale ?? "", proposedBy: ctx.actor!.id })
      .returning();
    await recordActivity(tx, {
      action: "relation.proposed",
      ideaIds: [edge.fromIdeaId, edge.toIdeaId],
      subject: { kind: "relation", id: created!.id },
      payload: edge as unknown as Record<string, unknown>,
    });
    return created!;
  });
  return (await relationDtos(ctx, [row]))[0]!;
}

export async function retractRelation(ctx: Ctx, relationId: string): Promise<void> {
  await inTransaction(ctx, async (tx) => {
    const [rel] = await tx.db.select().from(ideaRelations).where(eq(ideaRelations.id, relationId));
    if (!rel || rel.retractedAt) throw notFound("relation_not_found");
    const stewards = [
      ...(await currentStewardIds(tx.db, rel.fromIdeaId)),
      ...(await currentStewardIds(tx.db, rel.toIdeaId)),
    ];
    authorize(ctx.actor, "structure.curate", {
      isCreator: rel.proposedBy === ctx.actor?.id,
      isSteward: stewards.includes(ctx.actor?.id ?? ""),
    });
    await tx.db
      .update(ideaRelations)
      .set({ retractedAt: sql`now()`, retractedBy: ctx.actor!.id })
      .where(eq(ideaRelations.id, rel.id));
    await recordActivity(tx, {
      action: "relation.retracted",
      ideaIds: [rel.fromIdeaId, rel.toIdeaId],
      subject: { kind: "relation", id: rel.id },
      payload: { type: rel.type },
    });
  });
}

/** Relations of one idea, each phrased from that idea's point of view ("requires" / "is required by"). */
export async function listIdeaRelations(ctx: Ctx, ideaRef: string): Promise<IdeaRelationView[]> {
  const idea = await findIdea(ctx, ideaRef);
  const rows = await ctx.db
    .select()
    .from(ideaRelations)
    .where(
      and(
        or(eq(ideaRelations.fromIdeaId, idea.id), eq(ideaRelations.toIdeaId, idea.id)),
        isNull(ideaRelations.retractedAt),
      ),
    );
  const dtos = await relationDtos(ctx, rows);
  return dtos.map((d) => {
    const view = describeRelationFrom({ fromIdeaId: d.from.id, toIdeaId: d.to.id, type: d.type }, idea.id);
    // Symmetric relations are stored in canonical id order, so "other" must come from the endpoint ids, never
    // from the stored direction.
    return {
      ...d,
      phrase: view.phrase,
      direction: view.direction,
      other: d.from.id === view.otherIdeaId ? d.from : d.to,
    };
  });
}

/**
 * Traverses the idea graph from a focal idea.
 *  - downstream: ideas that build on the focus (requires / applies / extends / derived_from, followed in reverse):
 *    "if this is realised, what does it unlock?"
 *  - upstream:   what the focus builds on: "what must exist first?"
 *  - both:       the undirected neighbourhood over every relation type.
 * Uses a recursive CTE with cycle protection; depth is capped by the contract (MAX_GRAPH_DEPTH).
 */
export async function traverseGraph(ctx: Ctx, ideaRef: string, query: GraphQuery): Promise<GraphDto> {
  const focus = await findIdea(ctx, ideaRef);
  const buildsOn = sql.raw(BUILDS_ON_RELATION_TYPES.map((t) => `'${t}'`).join(", "));
  const step =
    query.direction === "downstream"
      ? sql`select r.from_idea_id as next_id from idea_relations r
            where r.to_idea_id = w.idea_id and r.retracted_at is null and r.type in (${buildsOn})`
      : query.direction === "upstream"
        ? sql`select r.to_idea_id as next_id from idea_relations r
              where r.from_idea_id = w.idea_id and r.retracted_at is null and r.type in (${buildsOn})`
        : sql`select case when r.from_idea_id = w.idea_id then r.to_idea_id else r.from_idea_id end as next_id
              from idea_relations r
              where (r.from_idea_id = w.idea_id or r.to_idea_id = w.idea_id) and r.retracted_at is null`;

  const reached = await queryRows<{ idea_id: string; distance: number }>(
    ctx.db,
    sql`
      with recursive walk(idea_id, distance, path) as (
        select ${focus.id}::uuid, 0, array[${focus.id}::uuid]
        union all
        select n.next_id, w.distance + 1, w.path || n.next_id
        from walk w
        join lateral (${step}) n on true
        join ideas i on i.id = n.next_id and i.hidden_at is null
        where w.distance < ${query.depth} and not (n.next_id = any(w.path))
      )
      select idea_id, min(distance)::int as distance from walk group by idea_id
    `,
  );
  const distance = new Map(reached.map((r) => [r.idea_id, r.distance]));
  const ids = [...distance.keys()];
  const typeFilter = query.direction === "both" ? sql`` : sql`and r.type in (${buildsOn})`;
  const edges = ids.length
    ? await queryRows<{ id: string; type: RelationRow["type"]; from_idea_id: string; to_idea_id: string }>(
        ctx.db,
        sql`select r.id, r.type, r.from_idea_id, r.to_idea_id from idea_relations r
            where r.retracted_at is null and r.from_idea_id in ${ids} and r.to_idea_id in ${ids} ${typeFilter}`,
      )
    : [];
  const [refs, topicMap] = await Promise.all([ideaRefs(ctx.db, ids), topicRefsByIdea(ctx.db, ids)]);
  return {
    focusId: focus.id,
    nodes: ids
      .filter((id) => refs.has(id))
      .map((id) => ({
        ...refs.get(id)!,
        distance: distance.get(id)!,
        topics: (topicMap.get(id) ?? []).map((t) => t.slug),
      }))
      .sort((a, b) => a.distance - b.distance || a.title.localeCompare(b.title)),
    edges: edges.map((e) => ({ id: e.id, type: e.type, from: e.from_idea_id, to: e.to_idea_id })),
  };
}
