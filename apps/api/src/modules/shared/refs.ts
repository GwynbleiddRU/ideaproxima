import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { IdeaRef, PersonRef, RatingSummaryDto, TopicRef } from "@ideaproxima/contracts";
import type { RatingSummary } from "@ideaproxima/domain";
import type { Database } from "../../db/client";
import { ideas, ideaTopics, people, topics } from "../../db/schema";

/** Batch loaders used to hydrate DTOs without N+1 queries. */

const unique = (ids: Iterable<string | null | undefined>) => [
  ...new Set([...ids].filter((x): x is string => !!x)),
];

export async function personRefs(
  db: Database,
  ids: Iterable<string | null | undefined>,
): Promise<Map<string, PersonRef>> {
  const list = unique(ids);
  if (!list.length) return new Map();
  const rows = await db
    .select({ id: people.id, handle: people.handle, displayName: people.displayName })
    .from(people)
    .where(inArray(people.id, list));
  return new Map(rows.map((r) => [r.id, r]));
}

/** Idea refs. Hidden ideas are omitted unless `includeHidden` (moderators). */
export async function ideaRefs(
  db: Database,
  ids: Iterable<string | null | undefined>,
  includeHidden = false,
): Promise<Map<string, IdeaRef>> {
  const list = unique(ids);
  if (!list.length) return new Map();
  const rows = await db
    .select({ id: ideas.id, slug: ideas.slug, title: ideas.title, stage: ideas.stage })
    .from(ideas)
    .where(includeHidden ? inArray(ideas.id, list) : and(inArray(ideas.id, list), isNull(ideas.hiddenAt)));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function topicRefsByIdea(
  db: Database,
  ideaIds: readonly string[],
): Promise<Map<string, TopicRef[]>> {
  const out = new Map<string, TopicRef[]>();
  if (!ideaIds.length) return out;
  const rows = await db
    .select({ ideaId: ideaTopics.ideaId, id: topics.id, slug: topics.slug, name: topics.name })
    .from(ideaTopics)
    .innerJoin(topics, eq(topics.id, ideaTopics.topicId))
    .where(inArray(ideaTopics.ideaId, [...ideaIds]))
    .orderBy(asc(ideaTopics.position));
  for (const r of rows) {
    const list = out.get(r.ideaId) ?? [];
    list.push({ id: r.id, slug: r.slug, name: r.name });
    out.set(r.ideaId, list);
  }
  return out;
}

/** A person ref that is always present, even if the row was somehow not loaded (defensive for history views). */
export const refOrUnknown = (map: Map<string, PersonRef>, id: string | null | undefined): PersonRef =>
  (id && map.get(id)) || { id: id ?? "", handle: "unknown", displayName: "Unknown contributor" };

export const iso = (d: Date): string => d.toISOString();
export const isoOrNull = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export const ratingDto = (s: RatingSummary | null | undefined): RatingSummaryDto | null =>
  s ? { value: s.normalizedMean, mean: s.mean, dispersion: s.normalizedSd, n: s.n } : null;
