import type { SearchResults } from "@ideaproxima/contracts";
import { queryRows } from "../../db/client";
import { sql } from "drizzle-orm";
import { listIdeaItems } from "../ideas/queries";
import { searchPeople } from "../identity/service";
import { searchClaims, searchSources } from "../knowledge/service";
import type { Ctx } from "../shared/context";

/**
 * Cross-entity search: ideas, claims, sources and people in one call. Postgres full-text search for now
 * (weighted title > summary, English stemming). Semantic search (embeddings via pgvector) is a planned upgrade
 * and fits the same endpoint — see docs/agents/open-questions.md.
 */
export async function search(ctx: Ctx, q: string, limit: number): Promise<SearchResults> {
  const ideaRows = await queryRows<{ id: string }>(
    ctx.db,
    sql`select i.id from ideas i
        where i.hidden_at is null and i.search @@ websearch_to_tsquery('english', ${q})
        order by ts_rank(i.search, websearch_to_tsquery('english', ${q})) desc, i.created_at desc
        limit ${limit}`,
  );
  const [ideas, claims, sources, people] = await Promise.all([
    listIdeaItems(
      ctx,
      ideaRows.map((r) => r.id),
    ),
    searchClaims(ctx.db, q, limit),
    searchSources(ctx.db, q, limit),
    searchPeople(ctx.db, q, limit),
  ]);
  return { ideas, claims, sources, people };
}
