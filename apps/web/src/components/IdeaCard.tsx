import { Link } from "@tanstack/react-router";
import { FileText, MessagesSquare, Star } from "lucide-react";
import type { IdeaListItem } from "@ideaproxima/contracts";
import type { DimensionKey } from "@ideaproxima/domain";
import { cx } from "@/lib/cx";
import { plural } from "@/lib/format";
import { DEFAULT_CARD_DIMENSIONS } from "@/lib/vocabulary";
import { RatingMeter } from "./Ratings";
import { StageBadge } from "./Stage";
import { TimeAgo, TopicLinks } from "./meta";
import styles from "./IdeaCard.module.scss";

/**
 * An idea in a list. Attention (a count of people) and assessed quality (rating meters with n) are shown
 * apart and look different: popularity is never presented as quality.
 */
export function IdeaCard({
  idea,
  layout = "card",
  dimensions = DEFAULT_CARD_DIMENSIONS,
  rank,
}: {
  idea: IdeaListItem;
  layout?: "card" | "row";
  dimensions?: DimensionKey[];
  /** Position in a ranked list, shown as a numeral. */
  rank?: number;
}) {
  const { signals } = idea;
  const { counts } = signals;
  return (
    <article className={cx(styles.card, styles[layout])}>
      {rank !== undefined && <span className={styles.rank}>{String(rank).padStart(2, "0")}</span>}
      <div className={styles.main}>
        <div className={styles.top}>
          <TopicLinks topics={idea.topics} limit={2} />
          <StageBadge stage={idea.stage} />
        </div>
        <h3 className={styles.title}>
          <Link to="/ideas/$idea" params={{ idea: idea.slug }} className={styles.link}>
            {idea.title}
          </Link>
        </h3>
        <p className={styles.summary}>{idea.summary}</p>
      </div>
      <div className={styles.signals}>
        {dimensions.map((d, i) => (
          <RatingMeter key={d} dimension={d} summary={signals.ratings[d]} size="sm" accent={i === 0} />
        ))}
      </div>
      <footer className={styles.foot}>
        <span
          className={styles.attention}
          title="People who marked this important. Popularity — not quality."
        >
          <Star aria-hidden /> {signals.attention}
          <span className="visually-hidden">people marked this important</span>
        </span>
        <span title="Claims this idea rests on">
          <FileText aria-hidden /> {plural(counts.claims, "claim")}
        </span>
        {counts.evidence > 0 && (
          <span title="Evidence attached to its claims">
            {counts.evidenceSupporting} supporting · {counts.evidenceChallenging} challenging
          </span>
        )}
        {counts.arguments + counts.comments > 0 && (
          <span title="Arguments and comments">
            <MessagesSquare aria-hidden /> {counts.arguments + counts.comments}
          </span>
        )}
        <span className={styles.updated}>
          updated <TimeAgo iso={idea.updatedAt} />
        </span>
      </footer>
    </article>
  );
}
