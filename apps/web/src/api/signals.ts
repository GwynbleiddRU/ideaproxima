import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DeclareInvolvementRequest,
  EvaluationDto,
  EvaluationTarget,
  IdeaDetail,
  InvolvementDto,
  Page,
  StancesResponse,
  SubmitEvaluationRequest,
  SubmitEvaluationResponse,
  WithdrawEvaluationResponse,
} from "@ideaproxima/contracts";
import { MUTUALLY_EXCLUSIVE_STANCES, type Capacity, type StanceKind } from "@ideaproxima/domain";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

const ideaPath = (ref: string) => `/ideas/${encodeURIComponent(ref)}`;

export const signalQueries = {
  /** Current ratings of a target by everyone (used to prefill the viewer's own ratings). */
  evaluations: (target: EvaluationTarget) =>
    queryOptions({
      queryKey: keys.evaluations(target.kind, target.id),
      queryFn: ({ signal }) =>
        http.get<Page<EvaluationDto>>(
          "/evaluations",
          { targetKind: target.kind, targetId: target.id, limit: 100 },
          signal,
        ),
    }),
  involvements: (ref: string) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "involvements"),
      queryFn: ({ signal }) => http.get<InvolvementDto[]>(`${ideaPath(ref)}/involvements`, undefined, signal),
    }),
};

/**
 * Take or retract a stance, optimistically: the button responds instantly and the server's answer (the full
 * set of the viewer's stances, with exclusions applied) replaces the guess.
 */
export function useStance(idea: IdeaDetail) {
  const queryClient = useQueryClient();
  const key = keys.idea(idea.slug);
  return useMutation({
    mutationFn: ({ kind, on }: { kind: StanceKind; on: boolean }) =>
      on
        ? http.put<StancesResponse>(`/ideas/${idea.id}/stances/${kind}`)
        : http.delete<StancesResponse>(`/ideas/${idea.id}/stances/${kind}`),
    onMutate: async ({ kind, on }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<IdeaDetail>(key);
      if (previous?.viewer) {
        const excluded = MUTUALLY_EXCLUSIVE_STANCES.flatMap(([a, b]) =>
          a === kind ? [b] : b === kind ? [a] : [],
        );
        const stances = on
          ? [...previous.viewer.stances.filter((s) => s !== kind && !excluded.includes(s)), kind]
          : previous.viewer.stances.filter((s) => s !== kind);
        queryClient.setQueryData<IdeaDetail>(key, { ...previous, viewer: { ...previous.viewer, stances } });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: keys.allIdeas }),
      ]),
  });
}

/** Ratings change derived signals of the target and, for ideas, the lenses. */
function evaluationInvalidations(target: EvaluationTarget, extra: readonly (readonly unknown[])[]) {
  return [keys.evaluations(target.kind, target.id), ...extra].map((k) => [...k]);
}

export function useSubmitEvaluation(target: EvaluationTarget, extra: readonly (readonly unknown[])[] = []) {
  return useApiMutation(
    (input: Omit<SubmitEvaluationRequest, "target">) =>
      http.post<SubmitEvaluationResponse>("/evaluations", { ...input, target }),
    evaluationInvalidations(target, extra),
    { inlineErrors: true },
  );
}

export function useWithdrawEvaluation(target: EvaluationTarget, extra: readonly (readonly unknown[])[] = []) {
  return useApiMutation(
    (dimensions: string[]) =>
      http.post<WithdrawEvaluationResponse>("/evaluations/withdraw", { target, dimensions }),
    evaluationInvalidations(target, extra),
    { success: "toast.ratingsWithdrawn" },
  );
}

export function useDeclareInvolvement(slug: string) {
  return useApiMutation(
    ({ capacity, ...input }: DeclareInvolvementRequest & { capacity: Capacity }) =>
      http.put<InvolvementDto[]>(`${ideaPath(slug)}/involvements/${capacity}`, input),
    [keys.idea(slug)],
    { inlineErrors: true, success: "toast.involvementRecorded" },
  );
}

export function useWithdrawInvolvement(slug: string) {
  return useApiMutation(
    (capacity: Capacity) => http.delete<InvolvementDto[]>(`${ideaPath(slug)}/involvements/${capacity}`),
    [keys.idea(slug)],
  );
}
