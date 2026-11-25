import { and, asc, eq, sql } from "drizzle-orm";
import type { IdeaRef, TopicDto, TopicTranslationDto, TopicTranslationRequest } from "@ideaproxima/contracts";
import { localizeVocabulary, type Locale } from "@ideaproxima/i18n";
import {
  DomainError,
  authorize,
  notFound,
  productVocabulary,
  slugify,
  type IdeaStage,
} from "@ideaproxima/domain";
import { queryRows } from "../../db/client";
import { topics, topicTranslations } from "../../db/schema";
import { lockKey } from "../shared/locks";
import { requireLocale } from "../shared/locales";
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
export async function listTopics(ctx: Ctx, locale: Locale): Promise<TopicDto[]> {
  const [rows, counts, latest] = await Promise.all([
    ctx.db
      .select({ topic: topics, name: topicTranslations.name, description: topicTranslations.description })
      .from(topics)
      .leftJoin(
        topicTranslations,
        and(eq(topicTranslations.topicId, topics.id), eq(topicTranslations.locale, locale)),
      )
      .orderBy(asc(topics.position), asc(topics.name)),
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
  return rows.map(({ topic, name, description }) =>
    topicDto(
      { ...topic, name: name ?? topic.name, description: description ?? topic.description },
      count.get(topic.id) ?? 0,
      newest.get(topic.id) ?? [],
    ),
  );
}

export async function getTopic(
  ctx: Ctx,
  slug: string,
  locale: Locale,
): Promise<TopicDto & { children: TopicDto[] }> {
  const all = await listTopics(ctx, locale);
  const topic = all.find((t) => t.slug === slug);
  if (!topic) throw notFound("topic_not_found");
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
    if (dup) throw new DomainError("conflict", "topic_slug_taken");
    let parentId: string | null = null;
    if (input.parentSlug) {
      const [parent] = await tx.db.select().from(topics).where(eq(topics.slug, input.parentSlug));
      if (!parent) throw new DomainError("validation_failed", "unknown_parent_topic");
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

export async function putTopicTranslation(
  ctx: Ctx,
  slug: string,
  tag: string,
  text: TopicTranslationRequest,
): Promise<TopicTranslationDto> {
  authorize(ctx.actor, "topic.manage");
  const locale = requireLocale(tag);
  return inTransaction(ctx, async (tx) => {
    await lockKey(tx, "topic-translation", slug, locale);
    const [topic] = await tx.db.select({ id: topics.id }).from(topics).where(eq(topics.slug, slug));
    if (!topic) throw notFound("topic_not_found");
    const changed = await tx.db
      .insert(topicTranslations)
      .values({ topicId: topic.id, locale, ...text })
      .onConflictDoUpdate({
        target: [topicTranslations.topicId, topicTranslations.locale],
        set: text,
        setWhere: sql`${topicTranslations.name} is distinct from ${text.name} or ${topicTranslations.description} is distinct from ${text.description}`,
      })
      .returning({ topicId: topicTranslations.topicId });
    if (changed.length) {
      await recordActivity(tx, {
        action: "topic.translation_updated",
        subject: { kind: "topic", id: topic.id },
        payload: { slug, locale },
      });
    }
    return { locale, ...text };
  });
}

const sourceVocabulary = productVocabulary();

export function vocabulary(locale: Locale) {
  return { locale, ...localizeVocabulary(sourceVocabulary, locale) };
}
