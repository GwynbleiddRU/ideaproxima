import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { MessageId } from "@/locales/messages";

type MutationMeta = {
  /** The form shows the error itself (field messages); skip the global error toast. */
  inlineErrors?: boolean;
  /** Render the toast in the active locale when the mutation succeeds. */
  success?: Extract<MessageId, `toast.${string}`>;
};

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: MutationMeta;
  }
}

type Invalidates<TData, TVars> = QueryKey[] | ((data: TData, vars: TVars) => QueryKey[]);

/**
 * A mutation that refreshes the queries it affects. Error toasts and success toasts are handled globally
 * (see app/query-client.ts) from `meta`, so call sites stay declarative.
 */
export function useApiMutation<TData, TVars = void>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidates: Invalidates<TData, TVars>,
  meta?: MutationMeta,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    meta,
    onSuccess: async (data, vars) => {
      const queryKeys = typeof invalidates === "function" ? invalidates(data, vars) : invalidates;
      await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}
