import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FileText, MessagesSquare, Rocket, Star } from "lucide-react";
import type { IdeaListItem } from "@ideaproxima/contracts";
import type { DimensionKey } from "@ideaproxima/domain";
import { cx } from "@/lib/cx";
import { formatCount } from "@/locales/runtime";
import { LocalizedText, useMessage } from "@/locales/react";
import { formatNumber } from "@/lib/format";
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
  topicNames,
  featured,
  children,
}: {
  idea: IdeaListItem;
  layout?: "card" | "row";
  dimensions?: DimensionKey[];
  /** A topic not to repeat, e.g. on that topic's own page. */
  omitTopic?: string;
  topicNames?: ReadonlyMap<string, string>;
  featured?: boolean;
  /** A note under the measures, e.g. why the idea appears in a lens. */
  children?: ReactNode;
}) {
  const t = useMessage();
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
          label={layout === "row" && d === "impact" ? t("idea.card.potential") : undefined}
        />
      ))}
    </div>
  );
  return (
    <article className={cx(styles.card, styles[layout], featured && styles.featured)}>
      <div className={styles.main}>
        <div className={styles.top}>
          <TopicLinks topics={topics} limit={2} topicNames={topicNames} />
          {layout === "card" && <StageBadge stage={idea.stage} />}
        </div>
        <h3 className={styles.title} dir="auto">
          <Link to="/ideas/$idea" params={{ idea: idea.slug }} className={styles.link}>
            {idea.title}
          </Link>
        </h3>
        <p className={styles.summary} dir="auto">
          {idea.summary}
        </p>
      </div>
      {measures}
      {children && <div className={styles.note}>{children}</div>}
      <footer className={styles.foot}>
        {layout === "row" && (
          <span>
            <LocalizedText
              id="idea.meta.proposedBy"
              components={{ 0: <PersonLink person={idea.proposedBy} /> }}
            />
          </span>
        )}
        <IdeaFacts idea={idea} />
        <span className={styles.when}>
          <LocalizedText
            id={idea.updatedAt !== idea.createdAt ? "idea.card.updated" : "idea.card.proposed"}
            components={{ 0: <TimeAgo iso={idea.updatedAt} /> }}
          />
        </span>
      </footer>
    </article>
  );
}

/** The non-zero facts about an idea: attention, claims, sources, discussion, initiatives. */
export function IdeaFacts({ idea }: { idea: IdeaListItem }) {
  const t = useMessage();
  const { attention, counts } = idea.signals;
  const discussion = counts.arguments + counts.comments;
  return (
    <>
      {attention > 0 && (
        <span className={styles.attention} title={t("idea.card.attentionHint")}>
          <Star aria-hidden /> <span aria-hidden>{formatNumber(attention)}</span>
          <span className="visually-hidden">{t("idea.card.importantCount", { count: attention })}</span>
        </span>
      )}
      {counts.claims > 0 && (
        <span title={t("idea.card.claimsHint")}>
          <FileText aria-hidden /> {formatCount("count.claim", counts.claims)}
        </span>
      )}
      {counts.evidence > 0 && (
        <span
          title={t("idea.card.evidenceHint", {
            supporting: counts.evidenceSupporting,
            challenging: counts.evidenceChallenging,
          })}
        >
          {formatCount("count.source", counts.evidence)}
        </span>
      )}
      {discussion > 0 && (
        <span title={t("idea.card.discussionHint")}>
          <MessagesSquare aria-hidden /> <span aria-hidden>{formatNumber(discussion)}</span>
          <span className="visually-hidden">{t("idea.card.discussionCount", { count: discussion })}</span>
        </span>
      )}
      {counts.initiatives > 0 && (
        <span title={t("idea.card.practiceHint")}>
          <Rocket aria-hidden /> {formatCount("count.initiative", counts.initiatives)}
        </span>
      )}
    </>
  );
}
