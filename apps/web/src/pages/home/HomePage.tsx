import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Gauge, Info, Lightbulb, Paperclip, Shuffle, Star } from "lucide-react";
import type { IdeaListItem } from "@ideaproxima/contracts";
import { LENS_INFO, type DimensionKey, type LensKey } from "@ideaproxima/domain";
import { catalogQueries, useTopicNames, useTopicsQueryOptions } from "@/api/catalog";
import { http } from "@/api/http";
import { ideaQueries } from "@/api/ideas";
import { ActivityFeed } from "@/components/ActivityFeed";
import { IdeaCard } from "@/components/IdeaCard";
import { PersonLink, TimeAgo, TopicLinks } from "@/components/meta";
import { SectionHeading } from "@/components/PageHeader";
import { isConfident, nearestAnchor } from "@/components/Ratings";
import { StageBadge } from "@/components/Stage";
import { cx } from "@/lib/cx";
import { formatDecimal, formatPaddedNumber } from "@/lib/format";
import { formatCount } from "@/locales/runtime";
import { topicIcon } from "@/lib/topic-icons";
import { DEFAULT_CARD_DIMENSIONS, LENS_DIMENSIONS, MIN_RATINGS_FOR_CONFIDENCE } from "@/lib/vocabulary";
import { Badge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { EmptyState, Skeleton } from "@/ui/Feedback";
import { Dots } from "@/ui/Meter";
import { Hero } from "./Hero";
import styles from "./HomePage.module.scss";

/** The lenses the home showcase offers, in tab order. */
const SHOWCASE: LensKey[] = ["potential", "neglected", "evidence", "in_practice", "contested"];

export function HomePage() {
  const t = useMessage();
  return (
    <div className={styles.page}>
      <title>{t("home.title")}</title>
      <Hero />
      <Showcase />
      <Domains />
      <Ladder />
      <HappeningNow />
      <Closing />
    </div>
  );
}

// ---------------------------------------------------------------- lens showcase

/**
 * One lens at a time: a featured idea with a line on why it is there, and three runners-up. Each tab states what
 * its lens measures; attention and assessed quality are never blended.
 */
function Showcase() {
  const t = useMessage();
  const [active, setActive] = useState<LensKey>(SHOWCASE[0]!);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = (index + step + SHOWCASE.length) % SHOWCASE.length;
    setActive(SHOWCASE[next]!);
    tabs.current[next]?.focus();
  };
  return (
    <section id="discover" className="container" aria-labelledby="discover-title">
      <SectionHeading
        id="discover-title"
        eyebrow={t("home.showcase.eyebrow")}
        title={t("home.showcase.title")}
        action={
          <ButtonLink to="/explore" variant="secondary" size="sm">
            {t("home.showcase.allLenses")} <ArrowRight />
          </ButtonLink>
        }
      />
      <div className={styles.lensTabs} role="tablist" aria-label={t("explore.lenses")}>
        {SHOWCASE.map((lens, i) => (
          <button
            key={lens}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`lens-tab-${lens}`}
            aria-selected={active === lens}
            aria-controls="lens-panel"
            tabIndex={active === lens ? 0 : -1}
            className={styles.lensTab}
            onClick={() => setActive(lens)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {vocabularyField("lenses", lens, "label", LENS_INFO[lens].label)}
          </button>
        ))}
      </div>
      <div id="lens-panel" role="tabpanel" aria-labelledby={`lens-tab-${active}`}>
        <LensPanel lens={active} />
      </div>
    </section>
  );
}

function LensPanel({ lens }: { lens: LensKey }) {
  const t = useMessage();
  const topicNames = useTopicNames();
  const { data, isPending } = useQuery(ideaQueries.top(lens, 4));
  const info = LENS_INFO[lens];
  const dimensions = LENS_DIMENSIONS[lens] ?? DEFAULT_CARD_DIMENSIONS;
  const [first, ...rest] = data?.items ?? [];
  return (
    <>
      <p className={styles.lensDescription}>
        <Badge
          tone={info.signal === "attention" ? "warning" : info.signal === "quality" ? "primary" : "neutral"}
        >
          {t(`lensSignal.${info.signal}.label`)}
        </Badge>
        {vocabularyField("lenses", lens, "description", info.description)}
      </p>
      {isPending ? (
        <Skeleton lines={6} />
      ) : !first ? (
        <EmptyState compact title={t("home.showcase.emptyTitle")}>
          {lens === "contested" ? t("home.showcase.contestedEmpty") : t("home.showcase.empty")}
        </EmptyState>
      ) : (
        <div className={styles.showcase}>
          <IdeaCard idea={first} featured dimensions={dimensions} topicNames={topicNames}>
            <Info aria-hidden />
            <span>
              <LensExplanation lens={lens} idea={first} />
            </span>
          </IdeaCard>
          <div className={styles.ranked}>
            {rest.length > 0 ? (
              <ol className={styles.rankedList} role="list">
                {rest.map((idea, i) => (
                  <li key={idea.id}>
                    <span className={styles.rank} aria-hidden>
                      {formatPaddedNumber(i + 2)}
                    </span>
                    <Link to="/ideas/$idea" params={{ idea: idea.slug }} className={styles.rankedTitle}>
                      {idea.title}
                    </Link>
                    <span className={styles.rankedMeta}>
                      <KeyMeasure idea={idea} dimension={dimensions[0]!} />
                      <StageBadge stage={idea.stage} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.alone}>{t("home.showcase.onlyIdea")}</p>
            )}
            <Link to="/explore" search={{ lens }} className={styles.more}>
              {t("home.showcase.seeAll", { lens: vocabularyField("lenses", lens, "label", info.label) })}{" "}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/** The measure a lens ranks on, in words: "Potential Civilization-scale 4.7", or "too early · 1 of 3". */
function KeyMeasure({ idea, dimension }: { idea: IdeaListItem; dimension: DimensionKey }) {
  const t = useMessage();
  const summary = idea.signals.ratings[dimension];
  if (summary && isConfident(summary))
    return (
      <span>
        <b>{nearestAnchor(dimension, summary.mean)}</b> {formatDecimal(summary.mean)}
      </span>
    );
  return (
    <span className={styles.early}>
      <Dots n={summary?.n ?? 0} of={MIN_RATINGS_FOR_CONFIDENCE} />{" "}
      {t("home.showcase.early", { count: summary?.n ?? 0, total: MIN_RATINGS_FOR_CONFIDENCE })}
    </span>
  );
}

/** One honest line on why the featured idea is in this lens, from its own signals. */
function LensExplanation({ lens, idea }: { lens: LensKey; idea: IdeaListItem }) {
  const t = useMessage();
  const { ratings, attention, counts } = idea.signals;
  const impact = ratings.impact;
  const needed = (n = 0) => MIN_RATINGS_FOR_CONFIDENCE - n;
  switch (lens) {
    case "potential":
    case "neglected": {
      const potential =
        impact && isConfident(impact)
          ? t("home.showcase.potential", {
              count: impact.n,
              anchor: nearestAnchor("impact", impact.mean),
              mean: formatDecimal(impact.mean),
            })
          : t("home.showcase.potentialEarly", { count: needed(impact?.n) });
      if (lens === "potential") return potential;
      return (
        <LocalizedText
          id="home.showcase.neglected"
          values={{ attention, potential }}
          components={{ 0: <Link to="/ideas/$idea" params={{ idea: idea.slug }} /> }}
        />
      );
    }
    case "evidence":
      return ratings.evidence && isConfident(ratings.evidence)
        ? t("home.showcase.evidence", {
            anchor: nearestAnchor("evidence", ratings.evidence.mean),
            mean: formatDecimal(ratings.evidence.mean),
            evaluators: ratings.evidence.n,
            count: counts.evidence,
          })
        : t("home.showcase.evidenceEarly", { count: counts.evidence });
    case "in_practice":
      return t("home.showcase.practice", { count: counts.initiatives });
    case "contested":
      return t("home.showcase.contested");
    default:
      return vocabularyField("lenses", lens, "description", LENS_INFO[lens].description);
  }
}

// ---------------------------------------------------------------- domains

function Domains() {
  const t = useMessage();
  const topics = useQuery(useTopicsQueryOptions());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const all = (topics.data ?? []).filter((t) => !t.parentId);
  // Active domains first (by count); the editorial order breaks ties and orders the empty ones. Eleven plus
  // "Surprise me" fill two rows; "All topics" leads to the rest.
  const sorted = [...all].sort((a, b) => b.ideaCount - a.ideaCount).slice(0, 11);

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
    <section className="container" aria-labelledby="domains-title">
      <SectionHeading
        id="domains-title"
        eyebrow={t("home.domains.eyebrow")}
        title={t("home.domains.title")}
        action={
          <ButtonLink to="/topics" variant="secondary" size="sm">
            {t("explore.allTopics")} <ArrowRight />
          </ButtonLink>
        }
      />
      {topics.isPending ? (
        <Skeleton lines={3} />
      ) : (
        <ul className={styles.tiles} role="list">
          {sorted.map((topic) => {
            const Icon = topicIcon(topic.slug);
            return (
              <li key={topic.id}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: topic.slug }}
                  className={cx(styles.tile, topic.ideaCount === 0 && styles.tileEmpty)}
                >
                  <span className={styles.tileIcon} aria-hidden>
                    <Icon />
                  </span>
                  <b>{topic.name}</b>
                  <span>
                    {topic.ideaCount ? formatCount("count.idea", topic.ideaCount) : t("home.domains.first")}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={cx(styles.tile, styles.tileSurprise)}
              onClick={() => void surprise()}
            >
              <span className={styles.tileIcon} aria-hidden>
                <Shuffle />
              </span>
              <b>{t("home.domains.surprise")}</b>
              <span>{t("home.domains.random")}</span>
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- how to help

const RUNGS = [
  {
    icon: Star,
    title: "home.ladder.stance",
    cost: "home.ladder.stanceCost",
    text: "home.ladder.stanceDescription",
    link: { to: "/explore", search: {}, label: "home.ladder.stanceLink" },
  },
  {
    icon: Gauge,
    title: "idea.action.evaluate",
    cost: "home.ladder.evaluateCost",
    text: "home.ladder.evaluateDescription",
    link: { to: "/explore", search: { lens: "needs_review" as LensKey }, label: "home.ladder.evaluateLink" },
  },
  {
    icon: Paperclip,
    title: "home.ladder.evidence",
    cost: "home.ladder.evidenceCost",
    text: "home.ladder.evidenceDescription",
    link: { to: "/explore", search: { lens: "developed" as LensKey }, label: "home.ladder.evidenceLink" },
  },
  {
    icon: Lightbulb,
    title: "nav.propose",
    cost: "home.ladder.proposeCost",
    text: "home.ladder.proposeDescription",
    link: { to: "/new", search: {}, label: "home.ladder.proposeLink" },
  },
] as const;

function Ladder() {
  const t = useMessage();
  return (
    <section className={styles.band} aria-labelledby="help-title">
      <div className="container">
        <SectionHeading
          id="help-title"
          eyebrow={t("home.ladder.eyebrow")}
          title={t("home.ladder.title")}
          action={
            <Link to="/about" hash="stages" className={styles.more}>
              {t("home.ladder.stages")} <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        <ol className={styles.ladder} role="list">
          {RUNGS.map(({ icon: Icon, title, cost, text, link }) => (
            <li key={title} className={styles.rung}>
              <span className={styles.rungIcon} aria-hidden>
                <Icon />
              </span>
              <h3>{t(title)}</h3>
              <span className={styles.cost}>{t(cost)}</span>
              <p>{t(text)}</p>
              <Link to={link.to} search={link.search} className={styles.more}>
                {t(link.label)} <ArrowRight size={14} aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- happening now

function HappeningNow() {
  const t = useMessage();
  const topicNames = useTopicNames();
  const newest = useQuery(ideaQueries.top("newest", 3));
  const activity = useInfiniteQuery(catalogQueries.activity(undefined, 20));
  const entries = activity.data?.pages[0]?.items ?? [];
  return (
    <section className={cx("container", styles.now)} aria-label={t("home.recent.label")}>
      <div>
        <SectionHeading
          eyebrow={t("home.recent.newEyebrow")}
          title={t("home.recent.newTitle")}
          action={
            <Link to="/explore" search={{ lens: "newest" }} className={styles.more}>
              {t("home.recent.allNew")} <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        {newest.isPending ? (
          <Skeleton lines={6} />
        ) : newest.data?.items.length ? (
          <ol className={styles.fresh} role="list">
            {newest.data.items.map((idea) => (
              <li key={idea.id}>
                <TopicLinks topics={idea.topics} limit={2} topicNames={topicNames} />
                <Link to="/ideas/$idea" params={{ idea: idea.slug }} className={styles.freshTitle}>
                  {idea.title}
                </Link>
                <p>{idea.summary}</p>
                <span className={styles.freshMeta}>
                  <LocalizedText
                    id="home.recent.proposedBy"
                    components={{
                      0: <PersonLink person={idea.proposedBy} />,
                      1: <TimeAgo iso={idea.createdAt} />,
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title={t("home.recent.emptyTitle")}
            action={
              <ButtonLink to="/new" variant="primary">
                {t("home.recent.first")}
              </ButtonLink>
            }
          >
            {t("home.recent.empty")}
          </EmptyState>
        )}
      </div>
      <div>
        <SectionHeading
          eyebrow={t("home.recent.progressEyebrow")}
          title={t("home.recent.progressTitle")}
          action={
            <Link to="/activity" className={styles.more}>
              {t("home.recent.fullRecord")} <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        {activity.isPending ? <Skeleton lines={8} /> : <ActivityFeed entries={entries} max={6} />}
      </div>
    </section>
  );
}

function Closing() {
  const t = useMessage();
  return (
    <section className={cx("container", styles.closing)} aria-label={t("home.closing.label")}>
      <blockquote>{t("home.closing.quote")}</blockquote>
      <div className={styles.closingActions}>
        <ButtonLink to="/new" variant="primary">
          {t("home.closing.propose")}
        </ButtonLink>
        <ButtonLink to="/about" variant="secondary">
          {t("home.closing.principles")}
        </ButtonLink>
      </div>
    </section>
  );
}
