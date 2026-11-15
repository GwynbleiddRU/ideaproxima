import type { Term } from "./term";

/**
 * IDEA RELATIONSHIPS — the typed graph between ideas.
 *
 * concept.txt (updated): the platform serves scientists who need to see what an idea is connected to —
 * "as one idea is brought to life, they can instantly find other uses of it by browsing connected ideas".
 * That requires typed, directional edges, not a generic "related" list:
 *
 *   A requires B      — A cannot be realised without B.            B unlocks A.
 *   A applies B       — A is a specific application of B.          B has A as a use.
 *   A extends B       — A builds on / refines / generalises B.
 *   A derived_from B  — A originated as a variant of B (provenance).
 *
 * For those four "builds-on" types the edge points from the dependent idea (A) to its foundation (B).
 * "Downstream of B" = everything that builds on B = what B's realisation would unlock.
 *
 * Symmetric types (alternative_to, complements, conflicts_with) carry no direction; they are stored with
 * the endpoints in canonical order (see `normalizeRelation`) so duplicates are impossible.
 *
 * There is intentionally no untyped "related to" edge — similarity will come from search/embeddings, and
 * every stored edge should tell a scientist *how* two ideas connect. (Recorded in docs/agents/open-questions.md.)
 */
export const RELATION_TYPES = [
  "requires",
  "applies",
  "extends",
  "derived_from",
  "alternative_to",
  "complements",
  "conflicts_with",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface RelationTypeDefinition extends Term {
  symmetric: boolean;
  /** Phrase read from the source idea: "<from> requires <to>". */
  forward: string;
  /** Phrase read from the target idea: "<to> is required by <from>". */
  inverse: string;
  /** True when the edge means "from builds on to" — used for upstream/downstream traversal. */
  buildsOn: boolean;
}

export const RELATION_TYPE_INFO: Record<RelationType, RelationTypeDefinition> = {
  requires: {
    label: "Requires",
    description: "Cannot be realised without the other idea.",
    symmetric: false,
    forward: "requires",
    inverse: "is required by",
    buildsOn: true,
  },
  applies: {
    label: "Applies",
    description: "Is a specific application of the other idea.",
    symmetric: false,
    forward: "is an application of",
    inverse: "has application",
    buildsOn: true,
  },
  extends: {
    label: "Extends",
    description: "Builds on, refines or generalises the other idea.",
    symmetric: false,
    forward: "extends",
    inverse: "is extended by",
    buildsOn: true,
  },
  derived_from: {
    label: "Derived from",
    description: "Originated as a variant of the other idea.",
    symmetric: false,
    forward: "is derived from",
    inverse: "inspired",
    buildsOn: true,
  },
  alternative_to: {
    label: "Alternative to",
    description: "A different approach to the same goal.",
    symmetric: true,
    forward: "is an alternative to",
    inverse: "is an alternative to",
    buildsOn: false,
  },
  complements: {
    label: "Complements",
    description: "Stronger in combination.",
    symmetric: true,
    forward: "complements",
    inverse: "complements",
    buildsOn: false,
  },
  conflicts_with: {
    label: "Conflicts with",
    description: "Mutually incompatible, or each undermines the other.",
    symmetric: true,
    forward: "conflicts with",
    inverse: "conflicts with",
    buildsOn: false,
  },
};

export const BUILDS_ON_RELATION_TYPES = RELATION_TYPES.filter((t) => RELATION_TYPE_INFO[t].buildsOn);

/** Graph traversal direction relative to the focal idea. */
export const GRAPH_DIRECTIONS = ["upstream", "downstream", "both"] as const;
export type GraphDirection = (typeof GRAPH_DIRECTIONS)[number];
export const MAX_GRAPH_DEPTH = 4;
