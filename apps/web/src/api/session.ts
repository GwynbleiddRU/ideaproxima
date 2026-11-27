import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AuthResponse,
  RegistrationResponse,
  LoginRequest,
  MeResponse,
  PersonDto,
  RegisterRequest,
} from "@ideaproxima/contracts";
import type { Locale } from "@ideaproxima/i18n/locales";
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
    account: data,
    email: data?.email ?? null,
    emailVerified: data?.emailVerified ?? false,
    locale: data?.preferences.locale ?? null,
    loading: isPending,
    isModerator: me?.role === "moderator" || me?.role === "admin",
    isAdmin: me?.role === "admin",
  };
}

export function useSaveLocale() {
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: (locale: Locale) => http.patch<PersonDto>("/me", { locale }),
    meta: { inlineErrors: true },
  });

  return async (locale: Locale, applySelection: () => void) => {
    const person = await mutateAsync(locale);
    // Update the browser's higher-priority preferences before session subscribers resolve the locale again.
    applySelection();
    queryClient.setQueryData<MeResponse | null>(keys.me, (session) =>
      session?.person.id === person.id ? { ...session, preferences: { locale } } : session,
    );
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
    onSuccess: async () => change(await http.get<MeResponse>("/me")),
  });
}

export function useRegister(takeProof: () => Promise<RegisterRequest["challenge"]>) {
  const change = useSessionChange();
  return useMutation({
    mutationFn: async (input: RegisterRequest) =>
      http.post<RegistrationResponse>("/auth/register", { ...input, challenge: await takeProof() }),
    meta: { inlineErrors: true },
    onSuccess: async (auth) => {
      if ("person" in auth) await change(await http.get<MeResponse>("/me"));
    },
  });
}

export function useLogout() {
  const change = useSessionChange();
  return useMutation({
    mutationFn: () => http.post<{ ok: true }>("/auth/logout"),
    onSuccess: () => change(null),
  });
}
