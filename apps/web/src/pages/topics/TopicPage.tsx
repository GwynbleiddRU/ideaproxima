import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import type { IdeaListItem, TopicRef } from "@ideaproxima/contracts";
import { LENS_INFO, type LensKey } from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { ideaQueries } from "@/api/ideas";
import { IdeaCard } from "@/components/IdeaCard";
import { plural } from "@/lib/format";
import { topicIcon } from "@/lib/topic-icons";
import { DEFAULT_CARD_DIMENSIONS, LENS_DIMENSIONS } from "@/lib/vocabulary";
import { Button, ButtonLink } from "@/ui/Button";
import { ChipLink } from "@/ui/Chip";
import { EmptyState, Skeleton } from "@/ui/Feedback";
import styles from "./topics.module.scss";

const route = getRouteApi("/topics/$slug");
const TOPIC_LENSES: LensKey[] = ["newest", "potential", "neglected", "evidence", "attention", "in_practice"];

/** Topics that share ideas with this one, by how many — a natural next step for browsing. */
function relatedTopics(ideas: IdeaListItem[], exclude: Set<string>): (TopicRef & { shared: number })[] {
  const shared = new Map<string, TopicRef & { shared: number }>();
  for (const idea of ideas)
    for (const t of idea.topics)
      if (!exclude.has(t.slug)) shared.set(t.slug, { ...t, shared: (shared.get(t.slug)?.shared ?? 0) + 1 });
  return [...shared.values()].sort((a, b) => b.shared - a.shared).slice(0, 6);
}

export function TopicPage() {
  const { slug } = route.useParams();
  const { lens: lensParam } = route.useSearch();
  const lens = lensParam ?? "newest";
  const topic = useSuspenseQuery(catalogQueries.topic(slug)).data;
  const ideas = useInfiniteQuery(ideaQueries.list({ topic: slug, lens, limit: 12 }));
  const list = ideas.data?.pages.flatMap((p) => p.items) ?? [];
  const Icon = topicIcon(topic.slug);
  const related = relatedTopics(list, new Set([slug, ...topic.children.map((c) => c.slug)]));

  return (
    <div className="container">
      <title>{`${topic.name} · ideaproxima`}</title>
      <header className={styles.header}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to="/topics">Topics</Link> /
        </nav>
        <span className={styles.headerIcon} aria-hidden>
          <Icon />
        </span>
        <h1 className={styles.title}>{topic.name}</h1>
        <p className={styles.lede}>
          {topic.description} <span className={styles.subtle}>· {plural(topic.ideaCount, "idea")}</span>
        </p>
        <ButtonLink to="/new" variant="secondary" size="sm" className={styles.headerAction}>
          <Plus /> Propose an idea here
        </ButtonLink>
      </header>

      {topic.children.length > 0 && (
        <div className={styles.subtopics}>
          {topic.children.map((c) => (
            <ChipLink key={c.id} to="/topics/$slug" params={{ slug: c.slug }}>
              {c.name} · {c.ideaCount}
            </ChipLink>
          ))}
        </div>
      )}

      <div className={styles.layout}>
        <section aria-label={`Ideas in ${topic.name}`}>
          <nav className={styles.lensTabs} aria-label="Order">
            {TOPIC_LENSES.map((key) => (
              <Link
                key={key}
                to="/topics/$slug"
                params={{ slug }}
                search={{ lens: key === "newest" ? undefined : key }}
                // The list below changes in place; the reader stays where the tabs are.
                resetScroll={false}
                activeOptions={{ includeSearch: true }}
                className={styles.lensTab}
                title={LENS_INFO[key].description}
              >
                {LENS_INFO[key].label}
              </Link>
            ))}
          </nav>
          <p className={styles.lensNote}>{LENS_INFO[lens].description}</p>
          {ideas.isPending ? (
            <Skeleton lines={8} />
          ) : list.length ? (
            <ol className={styles.ideas} role="list">
              {list.map((idea) => (
                <li key={idea.id}>
                  <IdeaCard
                    idea={idea}
                    layout="row"
                    omitTopic={slug}
                    dimensions={LENS_DIMENSIONS[lens] ?? DEFAULT_CARD_DIMENSIONS}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title={topic.ideaCount ? "No ideas under this lens yet" : `No ideas in ${topic.name} yet`}
              action={
                topic.ideaCount ? undefined : (
                  <ButtonLink to="/new" variant="primary">
                    Propose the first
                  </ButtonLink>
                )
              }
            >
              {topic.ideaCount
                ? "Assessment-based lenses only include ideas with enough independent ratings."
                : "An idea does not need to be feasible, proven or popular to deserve preservation."}
            </EmptyState>
          )}
          {ideas.hasNextPage && (
            <div className={styles.more}>
              <Button onClick={() => void ideas.fetchNextPage()} loading={ideas.isFetchingNextPage}>
                Show more
              </Button>
            </div>
          )}
        </section>

        {related.length > 0 && (
          <aside className={styles.related} aria-labelledby="related-title">
            <h2 id="related-title" className={styles.relatedTitle}>
              Often together with
            </h2>
            <ul role="list">
              {related.map((t) => {
                const RelatedIcon = topicIcon(t.slug);
                return (
                  <li key={t.id}>
                    <Link to="/topics/$slug" params={{ slug: t.slug }} className={styles.relatedLink}>
                      <span className={styles.relatedIcon} aria-hidden>
                        <RelatedIcon />
                      </span>
                      {t.name}
                      <span className={styles.subtle}>{t.shared} shared</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link to="/topics" className={styles.allTopics}>
              All topics <ArrowRight aria-hidden />
            </Link>
          </aside>
        )}
      </div>
    </div>
  );
}
