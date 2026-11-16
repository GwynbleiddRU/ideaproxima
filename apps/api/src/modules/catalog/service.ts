import { asc, eq, sql } from "drizzle-orm";
import type { IdeaRef, TopicDto } from "@ideaproxima/contracts";
import * as domain from "@ideaproxima/domain";
import { DomainError, authorize, notFound, slugify, type IdeaStage } from "@ideaproxima/domain";
import { queryRows } from "../../db/client";
import { topics } from "../../db/schema";
import { recordActivity } from "../shared/activity";
import { inTransaction, type Ctx } from "../shared/context";

type TopicRow = typeof topics.$inferSelect;

/** How many of a topic's newest ideas the topic list carries (enough for a card, not a listing). */
const LATEST_PER_TOPIC = 2;

const topicDto = (t: TopicRow, ideaCount = 0, latestIdeas: IdeaRef[] = []): TopicDto => ({
  id: t.id,
  slug: t.slug,
  name: t.name,
  description: t.description,
  parentId: t.parentId,
  ideaCount,
  latestIdeas,
});

/**
 * Every topic with the number of visible ideas in it or its direct children (each idea counted once), and its
 * newest ideas. The SQL names every table explicitly: Drizzle renders a column of a single-table select as a
 * bare `"id"`, which inside a correlated subquery silently binds to the inner table — that is how topic counts
 * once read 0 everywhere.
 */
export async function listTopics(ctx: Ctx): Promise<TopicDto[]> {
  const [rows, counts, latest] = await Promise.all([
    ctx.db.select().from(topics).orderBy(asc(topics.position), asc(topics.name)),
    queryRows<{ topic_id: string; n: number }>(
      ctx.db,
      sql`select t.id as topic_id, count(distinct it.idea_id)::int as n
          from topics t
          join topics c on c.id = t.id or c.parent_id = t.id
          join idea_topics it on it.topic_id = c.id
          join ideas i on i.id = it.idea_id and i.hidden_at is null
          group by t.id`,
    ),
    queryRows<{ topic_id: string; id: string; slug: string; title: string; stage: IdeaStage }>(
      ctx.db,
      sql`select t.id as topic_id, x.id, x.slug, x.title, x.stage
          from topics t
          cross join lateral (
            select i.id, i.slug, i.title, i.stage, i.created_at
            from ideas i
            where i.hidden_at is null and exists (
              select 1 from idea_topics it join topics c on c.id = it.topic_id
              where it.idea_id = i.id and (c.id = t.id or c.parent_id = t.id))
            order by i.created_at desc
            limit ${LATEST_PER_TOPIC}
          ) x
          order by t.id, x.created_at desc`,
    ),
  ]);
  const count = new Map(counts.map((c) => [c.topic_id, c.n]));
  const newest = new Map<string, IdeaRef[]>();
  for (const { topic_id, ...idea } of latest) newest.set(topic_id, [...(newest.get(topic_id) ?? []), idea]);
  return rows.map((t) => topicDto(t, count.get(t.id) ?? 0, newest.get(t.id) ?? []));
}

export async function getTopic(ctx: Ctx, slug: string): Promise<TopicDto & { children: TopicDto[] }> {
  const all = await listTopics(ctx);
  const topic = all.find((t) => t.slug === slug);
  if (!topic) throw notFound("Topic");
  return { ...topic, children: all.filter((t) => t.parentId === topic.id) };
}

export async function createTopic(
  ctx: Ctx,
  input: { name: string; description?: string; parentSlug?: string; slug?: string },
): Promise<TopicDto> {
  authorize(ctx.actor, "topic.manage");
  return inTransaction(ctx, async (tx) => {
    const slug = input.slug ?? slugify(input.name, 60);
    const [dup] = await tx.db.select({ id: topics.id }).from(topics).where(eq(topics.slug, slug));
    if (dup) throw new DomainError("conflict", "A topic with that slug exists.");
    let parentId: string | null = null;
    if (input.parentSlug) {
      const [parent] = await tx.db.select().from(topics).where(eq(topics.slug, input.parentSlug));
      if (!parent) throw new DomainError("validation_failed", "Unknown parent topic.");
      parentId = parent.id;
    }
    const [row] = await tx.db
      .insert(topics)
      .values({ slug, name: input.name, description: input.description ?? "", parentId })
      .returning();
    await recordActivity(tx, {
      action: "topic.created",
      subject: { kind: "topic", id: row!.id },
      payload: { slug },
    });
    return topicDto(row!);
  });
}

/**
 * The full product vocabulary as data, so a client can render every label, description, scale anchor and lens
 * explanation from the same source the server validates against.
 */
export function vocabulary() {
  return {
    stages: domain.IDEA_STAGES.map((key) => ({ key, ...domain.IDEA_STAGE_INFO[key] })),
    sections: domain.IDEA_SECTIONS.map((key) => ({ key, ...domain.IDEA_SECTION_INFO[key] })),
    claimRoles: domain.CLAIM_ROLES.map((key) => ({ key, ...domain.CLAIM_ROLE_INFO[key] })),
    consequenceDepths: domain.CONSEQUENCE_DEPTHS.map((key) => ({
      key,
      ...domain.CONSEQUENCE_DEPTH_INFO[key],
    })),
    claimStatuses: domain.CLAIM_STATUSES.map((key) => ({ key, ...domain.CLAIM_STATUS_INFO[key] })),
    evidenceStances: domain.EVIDENCE_STANCES.map((key) => ({ key, ...domain.EVIDENCE_STANCE_INFO[key] })),
    sourceKinds: domain.SOURCE_KINDS.map((key) => ({ key, ...domain.SOURCE_KIND_INFO[key] })),
    argumentStances: domain.ARGUMENT_STANCES.map((key) => ({ key, ...domain.ARGUMENT_STANCE_INFO[key] })),
    commentKinds: domain.COMMENT_KINDS,
    dimensions: domain.DIMENSION_KEYS.map((key) => ({ key, ...domain.DIMENSIONS[key] })),
    confidenceLevels: domain.CONFIDENCE_LEVELS,
    stanceKinds: domain.STANCE_KINDS.map((key) => ({ key, ...domain.STANCE_KIND_INFO[key] })),
    capacities: domain.CAPACITIES.map((key) => ({ key, ...domain.CAPACITY_INFO[key] })),
    involvementStatuses: domain.INVOLVEMENT_STATUSES.map((key) => ({
      key,
      ...domain.INVOLVEMENT_STATUS_INFO[key],
    })),
    relationTypes: domain.RELATION_TYPES.map((key) => ({ key, ...domain.RELATION_TYPE_INFO[key] })),
    initiativeKinds: domain.INITIATIVE_KINDS.map((key) => ({ key, ...domain.INITIATIVE_KIND_INFO[key] })),
    initiativeStatuses: domain.INITIATIVE_STATUSES.map((key) => ({
      key,
      ...domain.INITIATIVE_STATUS_INFO[key],
    })),
    outcomeResults: domain.OUTCOME_RESULTS.map((key) => ({ key, ...domain.OUTCOME_RESULT_INFO[key] })),
    revisionStatuses: domain.REVISION_STATUSES.map((key) => ({ key, ...domain.REVISION_STATUS_INFO[key] })),
    lenses: domain.LENS_KEYS.map((key) => ({ key, ...domain.LENS_INFO[key] })),
    minRatingsForConfidence: domain.MIN_RATINGS_FOR_CONFIDENCE,
    metricsAlgorithm: domain.BASELINE_ALGORITHM,
    limits: domain.LIMITS,
  };
}
