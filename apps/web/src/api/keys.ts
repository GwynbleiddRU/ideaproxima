/**
 * Query keys, in one place. Hierarchical so invalidation can be broad or narrow: invalidating `idea(ref)`
 * refreshes the idea and everything under it (claims, relations, revisions…).
 */
export const keys = {
  me: ["me"] as const,
  ideas: (params: object) => ["ideas", params] as const,
  allIdeas: ["ideas"] as const,
  idea: (ref: string) => ["idea", ref] as const,
  ideaPart: (ref: string, part: string, extra?: unknown) =>
    extra === undefined ? (["idea", ref, part] as const) : (["idea", ref, part, extra] as const),
  claim: (id: string) => ["claim", id] as const,
  source: (id: string) => ["source", id] as const,
  argument: (id: string) => ["argument", id] as const,
  evaluations: (kind: string, id: string) => ["evaluations", kind, id] as const,
  topics: ["topics"] as const,
  topic: (slug: string) => ["topic", slug] as const,
  person: (handle: string) => ["person", handle] as const,
  activity: (action?: string) => ["activity", action ?? "all"] as const,
  search: (q: string) => ["search", q] as const,
};
