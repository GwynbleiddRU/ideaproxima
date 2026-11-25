import { inArray } from "drizzle-orm";
import { BASE_TOPICS, BASE_TOPIC_TRANSLATIONS } from "@ideaproxima/i18n";
import type { Database } from "./client";
import { topics, topicTranslations } from "./schema";

export { BASE_TOPICS };

/** Existing topic text and existing translations survive reseeding. */
export async function ensureBaseTopics(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(topics)
      .values(BASE_TOPICS.map((t, position) => ({ ...t, position })))
      .onConflictDoNothing({ target: topics.slug });

    const rows = await tx
      .select({ id: topics.id, slug: topics.slug })
      .from(topics)
      .where(
        inArray(
          topics.slug,
          BASE_TOPIC_TRANSLATIONS.map(({ slug }) => slug),
        ),
      );
    const ids = new Map(rows.map(({ id, slug }) => [slug, id]));
    const translations = BASE_TOPIC_TRANSLATIONS.map(({ slug, ...translation }) => ({
      topicId: ids.get(slug)!,
      ...translation,
    }));
    if (translations.length) await tx.insert(topicTranslations).values(translations).onConflictDoNothing();
  });
}
