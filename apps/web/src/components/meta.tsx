import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { PersonRef, TopicRef } from "@ideaproxima/contracts";
import { cx } from "@/lib/cx";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import styles from "./meta.module.scss";

/** A contributor's name linking to their profile, optionally with an avatar. */
export function PersonLink({
  person,
  avatar,
  size = 22,
}: {
  person: PersonRef;
  avatar?: boolean;
  size?: number;
}) {
  return (
    <Link to="/people/$handle" params={{ handle: person.handle }} className={styles.person}>
      {avatar && <Avatar name={person.displayName} seed={person.handle} size={size} />}
      <span>{person.displayName}</span>
    </Link>
  );
}

/** Relative time with the exact timestamp as a tooltip and machine-readable value. */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={cx(styles.time, className)}>
      {timeAgo(iso)}
    </time>
  );
}

/** Topic links; the first (primary) topic is emphasised. */
export function TopicLinks({ topics, limit = 4 }: { topics: TopicRef[]; limit?: number }) {
  return (
    <span className={styles.topics}>
      {topics.slice(0, limit).map((topic, i) => (
        <Link
          key={topic.id}
          to="/topics/$slug"
          params={{ slug: topic.slug }}
          className={cx(styles.topic, i === 0 && styles.primary)}
        >
          {topic.name}
        </Link>
      ))}
    </span>
  );
}

/** "Label · value" pairs separated by middots. */
export function MetaLine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx(styles.metaLine, className)}>{children}</p>;
}
