import type { Database } from "./client";
import { topics } from "./schema";

/**
 * The initial topic taxonomy (from the design exploration, which extended the MVP's domain list).
 * Idempotent: existing slugs are left untouched, so admins can rename/describe topics without the seed fighting them.
 */
export const BASE_TOPICS = [
  {
    slug: "technology",
    name: "Technology",
    description: "Machines, materials and tools that extend what we can make.",
  },
  { slug: "science", name: "Science", description: "New directions for how we come to know things." },
  { slug: "biology", name: "Biology", description: "Living systems as collaborators, not just subjects." },
  { slug: "medicine", name: "Medicine", description: "Bodies that heal, regenerate and endure." },
  {
    slug: "environment",
    name: "Environment",
    description: "Repairing and stewarding the planetary commons.",
  },
  { slug: "energy", name: "Energy", description: "Abundant, clean and shared power." },
  { slug: "space", name: "Space", description: "Humanity beyond a single world." },
  {
    slug: "governance",
    name: "Governance",
    description: "How people could decide things together, at every scale.",
  },
  { slug: "society", name: "Society", description: "New forms of belonging, cooperation and care." },
  { slug: "economics", name: "Economics", description: "Ways to allocate effort without wasting a planet." },
  { slug: "education", name: "Education", description: "Learning as a lifelong public good." },
  { slug: "humanity", name: "Humanity", description: "Memory, meaning and the long future of our species." },
] as const;

export async function ensureBaseTopics(db: Database): Promise<void> {
  await db
    .insert(topics)
    .values(BASE_TOPICS.map((t, position) => ({ ...t, position })))
    .onConflictDoNothing({ target: topics.slug });
}
