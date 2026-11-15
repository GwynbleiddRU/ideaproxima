import { MutationCache, QueryClient } from "@tanstack/react-query";
import { ApiError, errorMessage } from "@/api/http";
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
        if (!mutation.meta?.inlineErrors) toast.error(errorMessage(error));
      },
      onSuccess: (_data, _vars, _context, mutation) => {
        if (mutation.meta?.success) toast.success(mutation.meta.success);
      },
    }),
  });
}
