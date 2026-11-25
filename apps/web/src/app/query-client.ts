import { MutationCache, QueryClient } from "@tanstack/react-query";
import { ApiError, errorMessage } from "@/api/http";
import { message } from "@/locales/runtime";
import { toast } from "@/ui/Toast";

/**
 * Server-state cache. Defaults favour calm, predictable behaviour for a reading-heavy app: data stays fresh for
 * 30 s, no refetch on every window focus, and client errors (4xx) are never retried.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 2,
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _vars, _context, mutation) => {
        if (mutation.meta?.inlineErrors) return;
        const detail = errorMessage(error);
        const requestId = error instanceof ApiError && error.status >= 500 ? error.requestId : undefined;
        toast.error(requestId ? message("error.requestId", { detail, requestId }) : detail);
      },
      onSuccess: (_data, _vars, _context, mutation) => {
        if (mutation.meta?.success) toast.success(message(mutation.meta.success));
      },
    }),
  });
}
