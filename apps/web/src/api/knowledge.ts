import { queryOptions } from "@tanstack/react-query";
import type {
  AddClaimRequest,
  ArgumentDetailDto,
  ArgumentDto,
  AttachEvidenceRequest,
  ClaimDetailDto,
  CreateArgumentRequest,
  EvidenceDto,
  IdeaClaimDto,
  SourceDetailDto,
} from "@ideaproxima/contracts";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

const ideaPath = (ref: string) => `/ideas/${encodeURIComponent(ref)}`;

export const knowledgeQueries = {
  ideaClaims: (ref: string) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "claims"),
      queryFn: ({ signal }) => http.get<IdeaClaimDto[]>(`${ideaPath(ref)}/claims`, undefined, signal),
    }),
  claim: (id: string) =>
    queryOptions({
      queryKey: keys.claim(id),
      queryFn: ({ signal }) => http.get<ClaimDetailDto>(`/claims/${id}`, undefined, signal),
    }),
  source: (id: string) =>
    queryOptions({
      queryKey: keys.source(id),
      queryFn: ({ signal }) => http.get<SourceDetailDto>(`/sources/${id}`, undefined, signal),
    }),
  ideaArguments: (ref: string) =>
    queryOptions({
      queryKey: keys.ideaPart(ref, "arguments"),
      queryFn: ({ signal }) => http.get<ArgumentDto[]>(`${ideaPath(ref)}/arguments`, undefined, signal),
    }),
  argument: (id: string) =>
    queryOptions({
      queryKey: keys.argument(id),
      queryFn: ({ signal }) => http.get<ArgumentDetailDto>(`/arguments/${id}`, undefined, signal),
    }),
};

export function useAddClaim(slug: string) {
  return useApiMutation(
    (input: AddClaimRequest) => http.post<IdeaClaimDto>(`${ideaPath(slug)}/claims`, input),
    [keys.idea(slug)],
    { inlineErrors: true, success: "Claim added." },
  );
}

export function useUnlinkClaim(slug: string) {
  return useApiMutation(
    (linkId: string) => http.post<{ ok: true }>(`${ideaPath(slug)}/claims/${linkId}/unlink`),
    [keys.idea(slug)],
    { success: "Claim unlinked from this idea." },
  );
}

/** Evidence changes a claim's status everywhere it is used, so the claim and the current idea refresh. */
export function useAttachEvidence(claimId: string, slug?: string) {
  return useApiMutation(
    (input: AttachEvidenceRequest) => http.post<EvidenceDto>(`/claims/${claimId}/evidence`, input),
    slug ? [keys.claim(claimId), keys.idea(slug)] : [keys.claim(claimId)],
    { inlineErrors: true, success: "Evidence attached." },
  );
}

export function useWithdrawEvidence(claimId: string, slug?: string) {
  return useApiMutation(
    ({ evidenceId, reason }: { evidenceId: string; reason: string }) =>
      http.post<EvidenceDto>(`/evidence/${evidenceId}/withdraw`, { reason }),
    slug ? [keys.claim(claimId), keys.idea(slug)] : [keys.claim(claimId)],
    { inlineErrors: true, success: "Evidence withdrawn. It stays in the record, marked as withdrawn." },
  );
}

export function useCreateArgument(invalidate: readonly (readonly unknown[])[]) {
  return useApiMutation(
    (input: CreateArgumentRequest) => http.post<ArgumentDto>("/arguments", input),
    invalidate.map((k) => [...k]),
    { inlineErrors: true, success: "Argument added." },
  );
}

export function useWithdrawArgument(invalidate: readonly (readonly unknown[])[]) {
  return useApiMutation(
    ({ argumentId, reason }: { argumentId: string; reason: string }) =>
      http.post<ArgumentDto>(`/arguments/${argumentId}/withdraw`, { reason }),
    invalidate.map((k) => [...k]),
    { inlineErrors: true, success: "Argument withdrawn." },
  );
}
