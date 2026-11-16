import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FileText, MessagesSquare, Rocket, Star } from "lucide-react";
import type { IdeaListItem } from "@ideaproxima/contracts";
import type { DimensionKey } from "@ideaproxima/domain";
import { cx } from "@/lib/cx";
import { plural } from "@/lib/format";
import { DEFAULT_CARD_DIMENSIONS } from "@/lib/vocabulary";
import { RatingMeter } from "./Ratings";
import { StageBadge } from "./Stage";
import { PersonLink, TimeAgo, TopicLinks } from "./meta";
import styles from "./IdeaCard.module.scss";

/**
 * An idea in a list. Attention (a count of people) and assessed quality (rating meters with n) are shown apart
 * and look different: popularity is never presented as quality. Only facts that exist are listed — no "0 claims".
 *
 *  - `card`: a tile (home showcase, profile); `featured` makes it the large one.
 *  - `row`: a list row (explore, topic, search) — text on the left, stage and measures on the right.
 */
export function IdeaCard({
  idea,
  layout = "card",
  dimensions = DEFAULT_CARD_DIMENSIONS,
  omitTopic,
  featured,
  children,
}: {
  idea: IdeaListItem;
  layout?: "card" | "row";
  dimensions?: DimensionKey[];
  /** A topic not to repeat, e.g. on that topic's own page. */
  omitTopic?: string;
  featured?: boolean;
  /** A note under the measures, e.g. why the idea appears in a lens. */
  children?: ReactNode;
}) {
  const topics = omitTopic ? idea.topics.filter((t) => t.slug !== omitTopic) : idea.topics;
  const measures = (
    <div className={styles.signals}>
      {layout === "row" && <StageBadge stage={idea.stage} />}
      {dimensions.map((d, i) => (
        <RatingMeter
          key={d}
          dimension={d}
          summary={idea.signals.ratings[d]}
          size={featured ? "md" : "sm"}
          accent={i === 0}
          label={layout === "row" && d === "impact" ? "Potential" : undefined}
        />
      ))}
    </div>
  );
  return (
    <article className={cx(styles.card, styles[layout], featured && styles.featured)}>
      <div className={styles.main}>
        <div className={styles.top}>
          <TopicLinks topics={topics} limit={2} />
          {layout === "card" && <StageBadge stage={idea.stage} />}
        </div>
        <h3 className={styles.title}>
          <Link to="/ideas/$idea" params={{ idea: idea.slug }} className={styles.link}>
            {idea.title}
          </Link>
        </h3>
        <p className={styles.summary}>{idea.summary}</p>
      </div>
      {measures}
      {children && <div className={styles.note}>{children}</div>}
      <footer className={styles.foot}>
        {layout === "row" && (
          <span>
            Proposed by <PersonLink person={idea.proposedBy} />
          </span>
        )}
        <IdeaFacts idea={idea} />
        <span className={styles.when}>
          {idea.updatedAt !== idea.createdAt ? "updated " : "proposed "}
          <TimeAgo iso={idea.updatedAt} />
        </span>
      </footer>
    </article>
  );
}

/** The non-zero facts about an idea: attention, claims, sources, discussion, initiatives. */
export function IdeaFacts({ idea }: { idea: IdeaListItem }) {
  const { attention, counts } = idea.signals;
  const discussion = counts.arguments + counts.comments;
  return (
    <>
      {attention > 0 && (
        <span
          className={styles.attention}
          title="People who marked this important. Popularity — not quality."
        >
          <Star aria-hidden /> {attention}
          <span className="visually-hidden"> marked it important</span>
        </span>
      )}
      {counts.claims > 0 && (
        <span title="Claims this idea rests on">
          <FileText aria-hidden /> {plural(counts.claims, "claim")}
        </span>
      )}
      {counts.evidence > 0 && (
        <span
          title={`Evidence on its claims: ${counts.evidenceSupporting} supporting, ${counts.evidenceChallenging} challenging`}
        >
          {plural(counts.evidence, "source")}
        </span>
      )}
      {discussion > 0 && (
        <span title="Arguments and comments">
          <MessagesSquare aria-hidden /> {discussion}
          <span className="visually-hidden"> in discussion</span>
        </span>
      )}
      {counts.initiatives > 0 && (
        <span title="Research, experiments, pilots or deployments">
          <Rocket aria-hidden /> {plural(counts.initiatives, "initiative")}
        </span>
      )}
    </>
  );
}
