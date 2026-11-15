import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  ActivityDto,
  CreateTopicRequest,
  ModerationRequest,
  ModerationResponse,
  Page,
  SearchResults,
  TopicDetailDto,
  TopicDto,
} from "@ideaproxima/contracts";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

export const catalogQueries = {
  topics: () =>
    queryOptions({
      queryKey: keys.topics,
      queryFn: ({ signal }) => http.get<TopicDto[]>("/topics", undefined, signal),
      staleTime: 5 * 60_000,
    }),
  topic: (slug: string) =>
    queryOptions({
      queryKey: keys.topic(slug),
      queryFn: ({ signal }) => http.get<TopicDetailDto>(`/topics/${slug}`, undefined, signal),
    }),
  search: (q: string) =>
    queryOptions({
      queryKey: keys.search(q),
      queryFn: ({ signal }) => http.get<SearchResults>("/search", { q, limit: 20 }, signal),
      enabled: q.trim().length > 0,
    }),
  /** The public ledger; `action` is a verb prefix such as "moderation." (the moderation log). */
  activity: (action?: string, limit = 30) =>
    infiniteQueryOptions({
      queryKey: [...keys.activity(action), limit],
      queryFn: ({ pageParam, signal }) =>
        http.get<Page<ActivityDto>>("/activity", { action, limit, cursor: pageParam }, signal),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    }),
};

export function useCreateTopic() {
  return useApiMutation((input: CreateTopicRequest) => http.post<TopicDto>("/topics", input), [keys.topics], {
    inlineErrors: true,
    success: "Topic created.",
  });
}

/** Hide or restore any content. Visibility changes ripple through lists and counts, so everything refreshes. */
export function useModerate() {
  return useApiMutation(
    (input: ModerationRequest) => http.post<ModerationResponse>("/moderation", input),
    [[]],
    { inlineErrors: true },
  );
}
