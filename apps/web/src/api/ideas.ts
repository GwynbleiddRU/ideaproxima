import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  ActivityDto,
  AppointStewardRequest,
  DecideRevisionRequest,
  IdeaDetail,
  IdeaListItem,
  Page,
  ProposeIdeaRequest,
  RevisionDto,
  RevisionSummaryDto,
  StageTransitionDto,
  StageTransitionRequest,
  StewardDto,
  SubmitRevisionRequest,
} from "@ideaproxima/contracts";
import type { IdeaStage, LensKey, RevisionStatus } from "@ideaproxima/domain";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

export interface IdeaListParams {
  lens?: LensKey;
  topic?: string;
  stage?: IdeaStage;
  tag?: string;
  q?: string;
  limit?: number;
}

const ideaPath = (ref: string) => `/ideas/${encodeURIComponent(ref)}`;

export const ideaQueries = {
  /** A paged discovery list (Explore, topic pages). */
  list: (params: IdeaListParams) =>
    infiniteQueryOptions({
      queryKey: keys.ideas(params),
      queryFn: ({ pageParam, signal }) =>
        http.get<Page<IdeaListItem>>("/ideas", { ...params, cursor: pageParam }, signal),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    }),
  /** The first few ideas of a lens (home page modules). */
  top: (lens: LensKey, limit: number, extra: Omit<IdeaListParams, "lens" | "limit"> = {}) =>
    queryOptions({
      queryKey: keys.ideas({ ...extra, lens, limit, top: true }),
      queryFn: ({ signal }) => http.get<Page<IdeaListItem>>("/ideas", { ...extra, lens, limit }, signal),
    }),
  detail: (ref: string) =>
    queryOptions({
      queryKey: keys.idea(ref),
      queryFn: ({ signal }) => http.get<IdeaDetail>(ideaPath(ref), undefined, signal),
    }),
  revisions: (ref: string, status?: RevisionStatus) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "revisions", status ?? "all"),
      queryFn: ({ signal }) =>
        http.get<RevisionSummaryDto[]>(`${ideaPath(ref)}/revisions`, { status }, signal),
    }),
  revision: (ref: string, revisionId: string) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "revision", revisionId),
      queryFn: ({ signal }) =>
        http.get<RevisionDto>(`${ideaPath(ref)}/revisions/${revisionId}`, undefined, signal),
      staleTime: Infinity, // revisions are immutable
    }),
  stages: (ref: string) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "stages"),
      queryFn: ({ signal }) => http.get<StageTransitionDto[]>(`${ideaPath(ref)}/stages`, undefined, signal),
    }),
  timeline: (ref: string) =>
    infiniteQueryOptions({
      queryKey: keys.ideaPart(ref, "timeline"),
      queryFn: ({ pageParam, signal }) =>
        http.get<Page<ActivityDto>>(`${ideaPath(ref)}/timeline`, { limit: 25, cursor: pageParam }, signal),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    }),
};

export function useProposeIdea() {
  return useApiMutation(
    (input: ProposeIdeaRequest) => http.post<IdeaDetail>("/ideas", input),
    [keys.allIdeas, keys.topics],
    { inlineErrors: true, success: "Your idea is in the archive." },
  );
}

/** Stewards publish directly ("auto"); everyone else proposes a revision for the stewards to decide. */
export function useSubmitRevision(slug: string) {
  return useApiMutation(
    (input: SubmitRevisionRequest) => http.post<RevisionDto>(`${ideaPath(slug)}/revisions`, input),
    [keys.idea(slug), keys.allIdeas],
    { inlineErrors: true },
  );
}

export function useDecideRevision(slug: string) {
  return useApiMutation(
    ({ revisionId, ...input }: DecideRevisionRequest & { revisionId: string }) =>
      http.post<RevisionDto>(`${ideaPath(slug)}/revisions/${revisionId}/decision`, input),
    [keys.idea(slug), keys.allIdeas],
    { inlineErrors: true },
  );
}

export function useWithdrawRevision(slug: string) {
  return useApiMutation(
    (revisionId: string) => http.post<RevisionDto>(`${ideaPath(slug)}/revisions/${revisionId}/withdraw`),
    [keys.idea(slug)],
    { success: "Proposal withdrawn." },
  );
}

export function useTransitionStage(slug: string) {
  return useApiMutation(
    (input: StageTransitionRequest) => http.post<StageTransitionDto>(`${ideaPath(slug)}/stages`, input),
    [keys.idea(slug), keys.allIdeas],
    { inlineErrors: true, success: "Stage recorded." },
  );
}

export function useAppointSteward(slug: string) {
  return useApiMutation(
    (input: AppointStewardRequest) => http.post<StewardDto[]>(`${ideaPath(slug)}/stewards`, input),
    [keys.idea(slug)],
    { inlineErrors: true, success: "Steward appointed." },
  );
}
