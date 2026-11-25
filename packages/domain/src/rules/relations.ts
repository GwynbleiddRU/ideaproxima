import { DomainError } from "../errors";
import { RELATION_TYPE_INFO, type RelationType } from "../vocabulary/graph";

export interface RelationEndpoints {
  fromIdeaId: string;
  toIdeaId: string;
  type: RelationType;
}

/**
 * Canonical form of a relation. Directed relations are kept as given. Symmetric relations are stored with the
 * lexicographically smaller id first, so "A alternative_to B" and "B alternative_to A" are the same row and
 * the unique index can prevent duplicates.
 */
export function normalizeRelation(input: RelationEndpoints): RelationEndpoints {
  if (input.fromIdeaId === input.toIdeaId) {
    throw new DomainError("invariant_violated", "self_relation");
  }
  if (!RELATION_TYPE_INFO[input.type].symmetric) return { ...input };
  const [a, b] = [input.fromIdeaId, input.toIdeaId].sort();
  return { fromIdeaId: a!, toIdeaId: b!, type: input.type };
}

/** Reads a stored relation from the perspective of one of its endpoints. */
export function describeRelationFrom(
  relation: RelationEndpoints,
  focalIdeaId: string,
): { otherIdeaId: string; phrase: string; direction: "outgoing" | "incoming" | "symmetric" } {
  const info = RELATION_TYPE_INFO[relation.type];
  const outgoing = relation.fromIdeaId === focalIdeaId;
  const otherIdeaId = outgoing ? relation.toIdeaId : relation.fromIdeaId;
  if (info.symmetric) return { otherIdeaId, phrase: info.forward, direction: "symmetric" };
  return outgoing
    ? { otherIdeaId, phrase: info.forward, direction: "outgoing" }
    : { otherIdeaId, phrase: info.inverse, direction: "incoming" };
}
