import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginRequest, MeResponse, RegisterRequest } from "@ideaproxima/contracts";
import { ApiError, http } from "./http";
import { keys } from "./keys";

/** The signed-in person, or null. Anonymous visitors get null (the API answers 401), not an error. */
export const meQuery = queryOptions({
  queryKey: keys.me,
  queryFn: async (): Promise<MeResponse | null> => {
    try {
      return await http.get<MeResponse>("/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: Infinity,
});

export function useSession() {
  const { data, isPending } = useQuery(meQuery);
  const me = data?.person ?? null;
  return {
    me,
    email: data?.email ?? null,
    loading: isPending,
    isModerator: me?.role === "moderator" || me?.role === "admin",
    isAdmin: me?.role === "admin",
  };
}

/** Signing in or out changes viewer-specific data everywhere (stances, permissions): refetch it all. */
function useSessionChange() {
  const queryClient = useQueryClient();
  return async (session: MeResponse | null) => {
    queryClient.setQueryData(keys.me, session);
    await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  };
}

export function useLogin() {
  const change = useSessionChange();
  return useMutation({
    mutationFn: (input: LoginRequest) => http.post<AuthResponse>("/auth/login", input),
    meta: { inlineErrors: true },
    onSuccess: (auth, input) => change({ person: auth.person, email: input.email.trim().toLowerCase() }),
  });
}

export function useRegister() {
  const change = useSessionChange();
  return useMutation({
    mutationFn: (input: RegisterRequest) => http.post<AuthResponse>("/auth/register", input),
    meta: { inlineErrors: true },
    onSuccess: (auth, input) => change({ person: auth.person, email: input.email.trim().toLowerCase() }),
  });
}

export function useLogout() {
  const change = useSessionChange();
  return useMutation({
    mutationFn: () => http.post<{ ok: true }>("/auth/logout"),
    onSuccess: () => change(null),
  });
}
