import { queryOptions } from "@tanstack/react-query";
import type {
  CreateInitiativeRequest,
  InitiativeDto,
  RecordOutcomeRequest,
  UpdateInitiativeStatusRequest,
} from "@ideaproxima/contracts";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

const ideaPath = (ref: string) => `/ideas/${encodeURIComponent(ref)}`;

export const practiceQueries = {
  initiatives: (ref: string) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "initiatives"),
      queryFn: ({ signal }) => http.get<InitiativeDto[]>(`${ideaPath(ref)}/initiatives`, undefined, signal),
    }),
};

export function useCreateInitiative(slug: string) {
  return useApiMutation(
    (input: CreateInitiativeRequest) => http.post<InitiativeDto>(`${ideaPath(slug)}/initiatives`, input),
    [keys.idea(slug)],
    { inlineErrors: true, success: "Initiative recorded." },
  );
}

export function useUpdateInitiativeStatus(slug: string) {
  return useApiMutation(
    ({ initiativeId, ...input }: UpdateInitiativeStatusRequest & { initiativeId: string }) =>
      http.post<InitiativeDto>(`/initiatives/${initiativeId}/status`, input),
    [keys.idea(slug)],
    { inlineErrors: true, success: "Status updated." },
  );
}

export function useRecordOutcome(slug: string) {
  return useApiMutation(
    ({ initiativeId, ...input }: RecordOutcomeRequest & { initiativeId: string }) =>
      http.post<InitiativeDto>(`/initiatives/${initiativeId}/outcomes`, input),
    [keys.idea(slug)],
    { inlineErrors: true, success: "Outcome recorded. Failures are knowledge too." },
  );
}
