import { infiniteQueryOptions, queryOptions, useQuery } from "@tanstack/react-query";
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
import { useLocale } from "@/locales/react";
import { activeLocale } from "@/locales/runtime";
import { http } from "./http";
import { keys } from "./keys";
import { useApiMutation } from "./mutation";

export const catalogQueries = {
  topics: (locale = activeLocale()) =>
    queryOptions({
      queryKey: [...keys.topics, locale],
      queryFn: ({ signal }) => http.get<TopicDto[]>("/topics", { locale }, signal),
      staleTime: 5 * 60_000,
    }),
  topic: (slug: string, locale = activeLocale()) =>
    queryOptions({
      queryKey: [...keys.topic(slug), locale],
      queryFn: ({ signal }) => http.get<TopicDetailDto>(`/topics/${slug}`, { locale }, signal),
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

export const useTopicsQueryOptions = () => catalogQueries.topics(useLocale());
export const useTopicQueryOptions = (slug: string) => catalogQueries.topic(slug, useLocale());

const topicNamesBySlug = (topics: TopicDto[]) => new Map(topics.map(({ slug, name }) => [slug, name]));

/** Resolve locale-neutral topic references using the shared catalogue query. */
export function useTopicNames() {
  return useQuery({ ...useTopicsQueryOptions(), select: topicNamesBySlug }).data;
}

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
