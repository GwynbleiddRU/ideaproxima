import { queryOptions } from "@tanstack/react-query";
import type { GraphDto, IdeaRelationView, ProposeRelationRequest, RelationDto } from "@ideaproxima/contracts";
import type { GraphDirection } from "@ideaproxima/domain";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

const ideaPath = (ref: string) => `/ideas/${encodeURIComponent(ref)}`;

export const graphQueries = {
  relations: (ref: string) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "relations"),
      queryFn: ({ signal }) => http.get<IdeaRelationView[]>(`${ideaPath(ref)}/relations`, undefined, signal),
    }),
  graph: (ref: string, direction: GraphDirection, depth: number) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "graph", { direction, depth }),
      queryFn: ({ signal }) => http.get<GraphDto>(`${ideaPath(ref)}/graph`, { direction, depth }, signal),
    }),
};

/** A relation touches two ideas; both refresh (the other one is found by id in any cached detail). */
export function useProposeRelation(slug: string) {
  return useApiMutation(
    (input: ProposeRelationRequest) => http.post<RelationDto>("/relations", input),
    (relation) => [keys.idea(slug), keys.idea(relation.from.slug), keys.idea(relation.to.slug)],
    { inlineErrors: true, success: "toast.connectionRecorded" },
  );
}

export function useRetractRelation(slug: string) {
  return useApiMutation(
    (relationId: string) => http.post<{ ok: true }>(`/relations/${relationId}/retract`),
    [keys.idea(slug)],
    { success: "toast.connectionRetracted" },
  );
}
