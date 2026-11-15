import { infiniteQueryOptions } from "@tanstack/react-query";
import type { CommentDto, Page, PostCommentRequest } from "@ideaproxima/contracts";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

const ideaPath = (ref: string) => `/ideas/${encodeURIComponent(ref)}`;

export const discussionQueries = {
  comments: (ref: string) =>
    infiniteQueryOptions({
      queryKey: keys.ideaPart(ref, "comments"),
      queryFn: ({ pageParam, signal }) =>
        http.get<Page<CommentDto>>(`${ideaPath(ref)}/comments`, { limit: 100, cursor: pageParam }, signal),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    }),
};

export function usePostComment(slug: string) {
  return useApiMutation(
    (input: PostCommentRequest) => http.post<CommentDto>(`${ideaPath(slug)}/comments`, input),
    [keys.ideaPart(slug, "comments"), keys.idea(slug)],
    { inlineErrors: true },
  );
}

/** "Useful" is a binary evaluation on comments and arguments. */
export function useMarkUseful(invalidate: readonly (readonly unknown[])[]) {
  return useApiMutation(
    ({ kind, id, useful }: { kind: "comment" | "argument"; id: string; useful: boolean }) =>
      useful
        ? http.post("/evaluations", { target: { kind, id }, ratings: [{ dimension: "useful", value: 1 }] })
        : http.post("/evaluations/withdraw", { target: { kind, id }, dimensions: ["useful"] }),
    invalidate.map((k) => [...k]),
  );
}
