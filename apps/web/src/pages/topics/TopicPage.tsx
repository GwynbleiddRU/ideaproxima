import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { LENS_INFO, type LensKey } from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { ideaQueries } from "@/api/ideas";
import { IdeaCard } from "@/components/IdeaCard";
import { PageHeader } from "@/components/PageHeader";
import { DEFAULT_CARD_DIMENSIONS, LENS_DIMENSIONS } from "@/lib/vocabulary";
import { Button, ButtonLink } from "@/ui/Button";
import { ChipLink } from "@/ui/Chip";
import { EmptyState, Skeleton } from "@/ui/Feedback";
import styles from "./topics.module.scss";

const route = getRouteApi("/topics/$slug");
const TOPIC_LENSES: LensKey[] = ["newest", "attention", "potential", "evidence", "neglected", "in_practice"];

export function TopicPage() {
  const { slug } = route.useParams();
  const { lens: lensParam } = route.useSearch();
  const lens = lensParam ?? "newest";
  const topic = useSuspenseQuery(catalogQueries.topic(slug)).data;
  const ideas = useInfiniteQuery(ideaQueries.list({ topic: slug, lens, limit: 12 }));
  const list = ideas.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="container">
      <title>{`${topic.name} · ideaproxima`}</title>
      <PageHeader
        eyebrow={
          <>
            <Link to="/topics" className="link">
              Topics
            </Link>{" "}
            · {topic.ideaCount} ideas
          </>
        }
        title={topic.name}
        lede={topic.description}
        actions={
          <ButtonLink to="/new" variant="secondary">
            Propose an idea here
          </ButtonLink>
        }
      />
      {topic.children.length > 0 && (
        <div className={styles.subtopics}>
          {topic.children.map((c) => (
            <ChipLink key={c.id} to="/topics/$slug" params={{ slug: c.slug }}>
              {c.name} · {c.ideaCount}
            </ChipLink>
          ))}
        </div>
      )}
      <nav className={styles.lenses} aria-label="Order">
        {TOPIC_LENSES.map((key) => (
          <ChipLink
            key={key}
            to="/topics/$slug"
            params={{ slug }}
            search={{ lens: key === "newest" ? undefined : key }}
            activeOptions={{ includeSearch: true }}
            title={LENS_INFO[key].description}
          >
            {LENS_INFO[key].label}
          </ChipLink>
        ))}
      </nav>
      <p className={styles.lensNote}>{LENS_INFO[lens].description}</p>
      {ideas.isPending ? (
        <Skeleton lines={8} />
      ) : list.length ? (
        <div className={styles.ideas}>
          {list.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              dimensions={LENS_DIMENSIONS[lens] ?? DEFAULT_CARD_DIMENSIONS}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No ideas under this lens yet">
          Assessment-based lenses only include ideas with enough independent ratings.
        </EmptyState>
      )}
      {ideas.hasNextPage && (
        <div className={styles.more}>
          <Button onClick={() => void ideas.fetchNextPage()} loading={ideas.isFetchingNextPage}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
