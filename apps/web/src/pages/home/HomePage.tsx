import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, Gauge, Info, Lightbulb, Paperclip, Shuffle, Star } from "lucide-react";
import type { IdeaListItem } from "@ideaproxima/contracts";
import { LENS_INFO, type DimensionKey, type LensKey } from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { http } from "@/api/http";
import { ideaQueries } from "@/api/ideas";
import { ActivityFeed } from "@/components/ActivityFeed";
import { IdeaCard } from "@/components/IdeaCard";
import { PersonLink, TimeAgo, TopicLinks } from "@/components/meta";
import { SectionHeading } from "@/components/PageHeader";
import { isConfident, nearestAnchor } from "@/components/Ratings";
import { StageBadge } from "@/components/Stage";
import { cx } from "@/lib/cx";
import { plural } from "@/lib/format";
import { topicIcon } from "@/lib/topic-icons";
import {
  DEFAULT_CARD_DIMENSIONS,
  LENS_DIMENSIONS,
  MIN_RATINGS_FOR_CONFIDENCE,
  SIGNAL_INFO,
} from "@/lib/vocabulary";
import { Badge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { EmptyState, Skeleton } from "@/ui/Feedback";
import { Dots } from "@/ui/Meter";
import { Hero } from "./Hero";
import styles from "./HomePage.module.scss";

/** The lenses the home showcase offers, in tab order. */
const SHOWCASE: LensKey[] = ["potential", "neglected", "evidence", "in_practice", "contested"];

export function HomePage() {
  return (
    <div className={styles.page}>
      <title>ideaproxima · humanity's possible futures</title>
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
        eyebrow="Ways to discover"
        title="Many ways to look, never one ranking"
        action={
          <ButtonLink to="/explore" variant="secondary" size="sm">
            All lenses <ArrowRight />
          </ButtonLink>
        }
      />
      <div className={styles.lensTabs} role="tablist" aria-label="Lenses">
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
            {LENS_INFO[lens].label}
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
          {SIGNAL_INFO[info.signal].label}
        </Badge>
        {info.description}
      </p>
      {isPending ? (
        <Skeleton lines={6} />
      ) : !first ? (
        <EmptyState compact title="Nothing qualifies yet">
          {lens === "contested"
            ? "An idea appears here when confident evaluators split widely on one of its dimensions."
            : "That is information too. As ideas are evaluated and tried, this lens fills."}
        </EmptyState>
      ) : (
        <div className={styles.showcase}>
          <IdeaCard idea={first} featured dimensions={dimensions}>
            <Info aria-hidden />
            <span>{whyHere(lens, first)}</span>
          </IdeaCard>
          <div className={styles.ranked}>
            {rest.length > 0 ? (
              <ol className={styles.rankedList} role="list">
                {rest.map((idea, i) => (
                  <li key={idea.id}>
                    <span className={styles.rank} aria-hidden>
                      {String(i + 2).padStart(2, "0")}
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
              <p className={styles.alone}>The only idea in this lens so far.</p>
            )}
            <Link to="/explore" search={{ lens }} className={styles.more}>
              See all: {info.label.toLowerCase()} <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/** The measure a lens ranks on, in words: "Potential Civilization-scale 4.7", or "too early · 1 of 3". */
function KeyMeasure({ idea, dimension }: { idea: IdeaListItem; dimension: DimensionKey }) {
  const summary = idea.signals.ratings[dimension];
  if (summary && isConfident(summary))
    return (
      <span>
        <b>{nearestAnchor(dimension, summary.mean)}</b> {summary.mean.toFixed(1)}
      </span>
    );
  return (
    <span className={styles.early}>
      <Dots n={summary?.n ?? 0} of={MIN_RATINGS_FOR_CONFIDENCE} /> too early · {summary?.n ?? 0} of{" "}
      {MIN_RATINGS_FOR_CONFIDENCE}
    </span>
  );
}

/** One honest line on why the featured idea is in this lens, from its own signals. */
function whyHere(lens: LensKey, idea: IdeaListItem): ReactNode {
  const { ratings, attention, counts } = idea.signals;
  const impact = ratings.impact;
  const needed = (n = 0) => MIN_RATINGS_FOR_CONFIDENCE - n;
  switch (lens) {
    case "potential":
    case "neglected": {
      const potential =
        impact && isConfident(impact)
          ? `${plural(impact.n, "evaluator")} rated its potential ${nearestAnchor("impact", impact.mean)?.toLowerCase()} (${impact.mean.toFixed(1)}).`
          : `It needs ${plural(needed(impact?.n), "more evaluation")} before its potential shows.`;
      if (lens === "potential") return potential;
      return (
        <>
          {attention === 0
            ? "Nobody has marked it important yet. "
            : `Only ${attention} marked it important. `}
          {potential}{" "}
          <Link to="/ideas/$idea" params={{ idea: idea.slug }}>
            Take a look
          </Link>
        </>
      );
    }
    case "evidence":
      return ratings.evidence && isConfident(ratings.evidence)
        ? `Evaluators rate its evidence ${nearestAnchor("evidence", ratings.evidence.mean)?.toLowerCase()} (${ratings.evidence.mean.toFixed(1)}, n=${ratings.evidence.n}); ${plural(counts.evidence, "source")} on its claims.`
        : `${plural(counts.evidence, "source")} on its claims; its evidence rating is still too early to tell.`;
    case "in_practice":
      return `${plural(counts.initiatives, "initiative")} recorded — research, a pilot or a deployment — including how it went.`;
    case "contested":
      return "Confident evaluators disagree widely on at least one of its dimensions.";
    default:
      return LENS_INFO[lens].description;
  }
}

// ---------------------------------------------------------------- domains

function Domains() {
  const topics = useQuery(catalogQueries.topics());
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
        eyebrow="Or start from a domain"
        title="Domains of possibility"
        action={
          <ButtonLink to="/topics" variant="secondary" size="sm">
            All topics <ArrowRight />
          </ButtonLink>
        }
      />
      {topics.isPending ? (
        <Skeleton lines={3} />
      ) : (
        <ul className={styles.tiles} role="list">
          {sorted.map((t) => {
            const Icon = topicIcon(t.slug);
            return (
              <li key={t.id}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: t.slug }}
                  className={cx(styles.tile, t.ideaCount === 0 && styles.tileEmpty)}
                >
                  <span className={styles.tileIcon} aria-hidden>
                    <Icon />
                  </span>
                  <b>{t.name}</b>
                  <span>{t.ideaCount ? plural(t.ideaCount, "idea") : "Be the first"}</span>
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
              <b>Surprise me</b>
              <span>A random idea</span>
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
    title: "Say what matters",
    cost: "One click",
    text: "Mark an idea important, worth researching, plausible or doubtful. Counted as attention — never as quality.",
    link: { to: "/explore", search: {}, label: "Browse ideas" },
  },
  {
    icon: Gauge,
    title: "Evaluate",
    cost: "About two minutes",
    text: "Rate only what you can judge; “I don't know” is always an answer. Three evaluations make a measure visible.",
    link: { to: "/explore", search: { lens: "needs_review" as LensKey }, label: "Ideas that need review" },
  },
  {
    icon: Paperclip,
    title: "Add evidence",
    cost: "Ten minutes",
    text: "Attach a source to a claim — and say what it does not establish. Evidence added once counts everywhere.",
    link: { to: "/explore", search: { lens: "developed" as LensKey }, label: "Ideas with claims to examine" },
  },
  {
    icon: Lightbulb,
    title: "Propose an idea",
    cost: "A title and a summary are enough",
    text: "It does not need to be feasible, proven or popular. Speculation is allowed; others can develop it.",
    link: { to: "/new", search: {}, label: "Write it down" },
  },
] as const;

function Ladder() {
  return (
    <section className={styles.band} aria-labelledby="help-title">
      <div className="container">
        <SectionHeading
          id="help-title"
          eyebrow="The unit of value is progression, not engagement"
          title="Move an idea forward — in a minute or an afternoon"
          action={
            <Link to="/about" hash="stages" className={styles.more}>
              How an idea moves <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        <ol className={styles.ladder} role="list">
          {RUNGS.map(({ icon: Icon, title, cost, text, link }) => (
            <li key={title} className={styles.rung}>
              <span className={styles.rungIcon} aria-hidden>
                <Icon />
              </span>
              <h3>{title}</h3>
              <span className={styles.cost}>{cost}</span>
              <p>{text}</p>
              <Link to={link.to} search={link.search} className={styles.more}>
                {link.label} <ArrowRight size={14} aria-hidden />
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
  const newest = useQuery(ideaQueries.top("newest", 3));
  const activity = useInfiniteQuery(catalogQueries.activity(undefined, 20));
  const entries = activity.data?.pages[0]?.items ?? [];
  return (
    <section className={cx("container", styles.now)} aria-label="Happening now">
      <div>
        <SectionHeading
          eyebrow="Just proposed"
          title="Newest ideas"
          action={
            <Link to="/explore" search={{ lens: "newest" }} className={styles.more}>
              All new <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        {newest.isPending ? (
          <Skeleton lines={6} />
        ) : newest.data?.items.length ? (
          <ol className={styles.fresh} role="list">
            {newest.data.items.map((idea) => (
              <li key={idea.id}>
                <TopicLinks topics={idea.topics} limit={2} />
                <Link to="/ideas/$idea" params={{ idea: idea.slug }} className={styles.freshTitle}>
                  {idea.title}
                </Link>
                <p>{idea.summary}</p>
                <span className={styles.freshMeta}>
                  Proposed by <PersonLink person={idea.proposedBy} /> · <TimeAgo iso={idea.createdAt} />
                </span>
              </li>
            ))}
          </ol>
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
      <div>
        <SectionHeading
          eyebrow="The living record"
          title="Latest progress"
          action={
            <Link to="/activity" className={styles.more}>
              Full record <ArrowRight size={14} aria-hidden />
            </Link>
          }
        />
        {activity.isPending ? <Skeleton lines={8} /> : <ActivityFeed entries={entries} max={6} />}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className={cx("container", styles.closing)} aria-label="Why this exists">
      <blockquote>
        “Humanity should not lose a potentially valuable idea simply because the right person, technology or
        moment had not yet appeared.”
      </blockquote>
      <div className={styles.closingActions}>
        <ButtonLink to="/new" variant="primary">
          Propose a possibility
        </ButtonLink>
        <ButtonLink to="/about" variant="secondary">
          Read the principles
        </ButtonLink>
      </div>
    </section>
  );
}
