import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  ActivityDto,
  ChangePasswordRequest,
  DeclareExpertiseRequest,
  ExpertiseDto,
  Page,
  PersonDto,
  ProfileDto,
  UpdateProfileRequest,
} from "@ideaproxima/contracts";
import type { PersonRole } from "@ideaproxima/domain";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

export const peopleQueries = {
  profile: (handle: string) =>
    queryOptions({
      queryKey: keys.person(handle),
      queryFn: ({ signal }) => http.get<ProfileDto>(`/people/${handle}`, undefined, signal),
    }),
  activity: (handle: string) =>
    infiniteQueryOptions({
      queryKey: [...keys.person(handle), "activity"],
      queryFn: ({ pageParam, signal }) =>
        http.get<Page<ActivityDto>>(`/people/${handle}/activity`, { limit: 20, cursor: pageParam }, signal),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    }),
};

export function useUpdateProfile(handle: string) {
  return useApiMutation(
    (input: UpdateProfileRequest) => http.patch<PersonDto>("/me", input),
    [keys.me, keys.person(handle)],
    { inlineErrors: true, success: "Profile saved." },
  );
}

export function useChangePassword() {
  return useApiMutation(
    (input: ChangePasswordRequest) => http.post<{ ok: true }>("/me/password", input),
    [],
    { inlineErrors: true, success: "Password changed. Your other sessions were signed out." },
  );
}

export function useDeclareExpertise(handle: string) {
  return useApiMutation(
    (input: DeclareExpertiseRequest) => http.post<ExpertiseDto[]>("/me/expertise", input),
    [keys.person(handle)],
    { inlineErrors: true, success: "Expertise declared." },
  );
}

export function useRevokeExpertise(handle: string) {
  return useApiMutation(
    (topic: string) => http.delete<ExpertiseDto[]>(`/me/expertise/${topic}`),
    [keys.person(handle)],
  );
}

export function useSetActive(handle: string) {
  return useApiMutation(
    ({ active, reason }: { active: boolean; reason: string }) =>
      http.post<PersonDto>(`/people/${handle}/${active ? "reactivate" : "deactivate"}`, { reason }),
    [keys.person(handle)],
    { inlineErrors: true },
  );
}

export function useSetRole(handle: string) {
  return useApiMutation(
    (role: PersonRole) => http.put<PersonDto>(`/people/${handle}/role`, { role }),
    [keys.person(handle)],
    { success: "Role changed. The change is recorded in the public activity log." },
  );
}
