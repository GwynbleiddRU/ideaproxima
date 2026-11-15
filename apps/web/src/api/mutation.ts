import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** The form shows the error itself (field messages); skip the global error toast. */
      inlineErrors?: boolean;
      /** Toast shown on success. */
      success?: string;
    };
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
  meta?: { inlineErrors?: boolean; success?: string },
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
