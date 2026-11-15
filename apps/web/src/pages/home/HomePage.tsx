import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Shuffle } from "lucide-react";
import type { IdeaListItem } from "@ideaproxima/contracts";
import {
  IDEA_STAGE_INFO,
  IDEA_STAGES,
  LENS_INFO,
  type DimensionKey,
  type LensKey,
} from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { http } from "@/api/http";
import { ideaQueries } from "@/api/ideas";
import { ActivityItem, ActivityList } from "@/components/ActivityItem";
import { IdeaCard } from "@/components/IdeaCard";
import { SectionHeading } from "@/components/PageHeader";
import { RatingMeter } from "@/components/Ratings";
import { StageBadge } from "@/components/Stage";
import { cx } from "@/lib/cx";
import { SIGNAL_INFO } from "@/lib/vocabulary";
import { Badge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { Chip, ChipLink } from "@/ui/Chip";
import { EmptyState, Skeleton } from "@/ui/Feedback";
import { Hero } from "./Hero";
import styles from "./HomePage.module.scss";

/** The lenses featured on the home page, each with the measure its rows show. */
const FEATURED: { lens: LensKey; dimension?: DimensionKey }[] = [
  { lens: "potential", dimension: "impact" },
  { lens: "neglected", dimension: "impact" },
  { lens: "evidence", dimension: "evidence" },
  { lens: "in_practice" },
];

export function HomePage() {
  return (
    <div className={styles.page}>
      <title>ideaproxima · humanity's possible futures</title>
      <Hero />
      <Lenses />
      <Lifecycle />
      <Recent />
      <Closing />
    </div>
  );
}

/** Below the fold: start from a domain, or let chance pick an idea. */
function TopicStrip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const topics = useQuery(catalogQueries.topics());
  const featured = [...(topics.data ?? [])].sort((a, b) => b.ideaCount - a.ideaCount).slice(0, 8);

  const surprise = async () => {
    const page = await queryClient.fetchQuery({
      queryKey: ["surprise-pool"],
      queryFn: () => http.get<{ items: IdeaListItem[] }>("/ideas", { lens: "newest", limit: 100 }),
      staleTime: 60_000,
    });
    const pick = page.items[Math.floor(Math.random() * page.items.length)];
    if (pick) void navigate({ to: "/ideas/$idea", params: { idea: pick.slug } });
  };

  return (
    <div className={styles.topicStrip}>
      <p className={styles.topicLabel}>Or start from a domain</p>
      <div className={styles.topicChips}>
        {featured.map((t) => (
          <ChipLink key={t.id} to="/topics/$slug" params={{ slug: t.slug }}>
            {t.name}
          </ChipLink>
        ))}
        <ChipLink to="/topics">All topics</ChipLink>
        <Chip onClick={() => void surprise()} className={styles.surprise}>
          <Shuffle aria-hidden /> Surprise me
        </Chip>
      </div>
    </div>
  );
}

function LensPanel({ lens, dimension }: { lens: LensKey; dimension?: DimensionKey }) {
  const { data, isPending } = useQuery(ideaQueries.top(lens, 3));
  const info = LENS_INFO[lens];
  return (
    <article className={styles.lens}>
      <header className={styles.lensHead}>
        <Badge
          tone={info.signal === "attention" ? "warning" : info.signal === "quality" ? "primary" : "neutral"}
        >
          {SIGNAL_INFO[info.signal].label}
        </Badge>
        <h3 className={styles.lensTitle}>{info.label}</h3>
        <p className={styles.lensDescription}>{info.description}</p>
      </header>
      {isPending ? (
        <Skeleton lines={4} />
      ) : data?.items.length ? (
        <ol className={styles.lensList} role="list">
          {data.items.map((idea) => (
            <li key={idea.id}>
              <Link to="/ideas/$idea" params={{ idea: idea.slug }} className={styles.lensIdea}>
                {idea.title}
              </Link>
              {dimension ? (
                <RatingMeter
                  dimension={dimension}
                  summary={idea.signals.ratings[dimension]}
                  size="sm"
                  accent
                />
              ) : (
                <StageBadge stage={idea.stage} />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.lensEmpty}>Nothing qualifies yet. That is information too.</p>
      )}
      <Link to="/explore" search={{ lens }} className={styles.more}>
        See all <ArrowRight size={14} aria-hidden />
      </Link>
    </article>
  );
}

function Lenses() {
  return (
    <section id="discover" className="container">
      <SectionHeading
        eyebrow="Discovery"
        title="Many ways to look, never one ranking"
        action={
          <ButtonLink to="/explore" variant="secondary" size="sm">
            All lenses
          </ButtonLink>
        }
      />
      <p className={styles.sectionLede}>
        Each lens states what it measures. Attention shows what people care about; assessed quality comes from
        independent, multi-dimensional evaluations. They are never blended into one score.
      </p>
      <div className={styles.lenses}>
        {FEATURED.map((f) => (
          <LensPanel key={f.lens} {...f} />
        ))}
      </div>
      <TopicStrip />
    </section>
  );
}

function Lifecycle() {
  return (
    <section className={styles.lifecycleBand}>
      <div className="container">
        <SectionHeading
          eyebrow="The unit of value is progression, not engagement"
          title="How an idea moves"
        />
        <ol className={styles.lifecycle} role="list">
          {IDEA_STAGES.map((stage, i) => (
            <li key={stage}>
              <Link to="/explore" search={{ stage }} className={styles.stage}>
                <span className={styles.stageNumber}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.stageLabel}>{IDEA_STAGE_INFO[stage].label}</span>
                <span className={styles.stageDescription}>{IDEA_STAGE_INFO[stage].description}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Recent() {
  const newest = useQuery(ideaQueries.top("newest", 4));
  const activity = useInfiniteQuery(catalogQueries.activity(undefined, 8));
  const entries = activity.data?.pages[0]?.items ?? [];
  return (
    <section className={cx("container", styles.recent)}>
      <div>
        <SectionHeading
          eyebrow="Just proposed"
          title="Newest ideas"
          action={
            <Link to="/explore" search={{ lens: "newest" }} className={styles.more}>
              All new ideas <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        {newest.isPending ? (
          <Skeleton lines={6} />
        ) : newest.data?.items.length ? (
          <div className={styles.newest}>
            {newest.data.items.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="The archive is empty"
            action={
              <ButtonLink to="/new" variant="primary">
                Propose the first idea
              </ButtonLink>
            }
          >
            Every future starts with someone writing it down.
          </EmptyState>
        )}
      </div>
      <aside className={styles.activity}>
        <SectionHeading
          eyebrow="The living record"
          title="Activity"
          action={
            <Link to="/activity" className={styles.more}>
              Full ledger <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        {activity.isPending ? (
          <Skeleton lines={8} />
        ) : (
          <ActivityList>
            {entries.map((entry) => (
              <ActivityItem key={entry.id} entry={entry} />
            ))}
          </ActivityList>
        )}
      </aside>
    </section>
  );
}

function Closing() {
  return (
    <section className={cx("container", styles.closing)}>
      <blockquote>
        “Humanity should not lose a potentially valuable idea simply because the right person, technology or
        moment had not yet appeared.”
      </blockquote>
      <div className={styles.closingActions}>
        <ButtonLink to="/new" variant="primary" size="lg">
          Propose a possibility
        </ButtonLink>
        <ButtonLink to="/about" variant="secondary" size="lg">
          Read the principles
        </ButtonLink>
      </div>
    </section>
  );
}
