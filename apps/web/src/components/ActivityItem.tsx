import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { ActivityDto } from "@ideaproxima/contracts";
import {
  IDEA_STAGE_INFO,
  INITIATIVE_STATUS_INFO,
  OUTCOME_RESULT_INFO,
  type IdeaStage,
  type InitiativeStatus,
  type OutcomeResult,
} from "@ideaproxima/domain";
import { cx } from "@/lib/cx";
import { dimensionLabel } from "@/lib/vocabulary";
import { PersonLink, TimeAgo } from "./meta";
import styles from "./ActivityItem.module.scss";

type Payload = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

/**
 * What happened, as a sentence ("attached supporting evidence to a claim in …"). Every verb of the activity
 * ledger has a phrase; unknown verbs fall back to the raw action, so new backend verbs never break the feed.
 */
function describe(action: string, p: Payload): ReactNode {
  switch (action) {
    case "idea.proposed":
      return "proposed an idea";
    case "revision.published":
      return (
        <>
          published revision {String(p.number)}
          {p.changeNote ? <q>{str(p.changeNote)}</q> : null}
        </>
      );
    case "revision.proposed":
      return (
        <>
          proposed revision {String(p.number)}
          {p.changeNote ? <q>{str(p.changeNote)}</q> : null}
        </>
      );
    case "revision.accepted":
      return `accepted revision ${String(p.number)}`;
    case "revision.rejected":
      return `declined revision ${String(p.number)}`;
    case "revision.withdrawn":
      return `withdrew revision ${String(p.number)}`;
    case "stage.changed":
      return `moved the idea to “${IDEA_STAGE_INFO[p.to as IdeaStage]?.label ?? str(p.to)}”`;
    case "steward.appointed":
      return "appointed a steward";
    case "claim.stated":
      return (
        <>
          stated a claim <q>{str(p.statement)}</q>
        </>
      );
    case "claim.linked":
      return `linked a claim as ${str(p.role)}`;
    case "claim.unlinked":
      return "unlinked a claim";
    case "evidence.attached":
      return `attached ${str(p.stance) === "supports" ? "supporting" : str(p.stance) === "challenges" ? "challenging" : "mixed"} evidence to a claim`;
    case "evidence.withdrawn":
      return "withdrew evidence";
    case "source.registered":
      return (
        <>
          registered a source <q>{str(p.title)}</q>
        </>
      );
    case "argument.made":
      return (
        <>
          argued ({str(p.stance)}) <q>{str(p.title)}</q>
        </>
      );
    case "argument.withdrawn":
      return "withdrew an argument";
    case "evaluation.submitted": {
      const dims = list(p.dimensions).map(dimensionLabel);
      const kind = str((p.target as Payload | undefined)?.kind);
      return `rated ${kind ? `a${kind === "idea" || kind === "argument" || kind === "evidence" ? "n" : ""} ${kind}` : "something"}${dims.length ? ` on ${dims.join(", ").toLowerCase()}` : ""}`;
    }
    case "evaluation.withdrawn":
      return "withdrew ratings";
    case "stance.taken":
      return `marked an idea “${str(p.kind).replace("_", " ")}”`;
    case "stance.retracted":
      return "retracted a stance";
    case "involvement.declared":
      return `got involved (${str(p.capacity)})`;
    case "involvement.withdrawn":
      return "ended an involvement";
    case "relation.proposed":
      return `connected two ideas (${str(p.type).replace("_", " ")})`;
    case "relation.retracted":
      return "retracted a connection";
    case "initiative.created":
      return (
        <>
          recorded an initiative <q>{str(p.title)}</q>
        </>
      );
    case "initiative.status_changed":
      return `marked an initiative ${INITIATIVE_STATUS_INFO[p.to as InitiativeStatus]?.label.toLowerCase() ?? str(p.to)}`;
    case "outcome.recorded":
      return `recorded an outcome: ${OUTCOME_RESULT_INFO[p.result as OutcomeResult]?.label.toLowerCase() ?? str(p.result)}`;
    case "comment.posted":
      return str(p.kind) === "question"
        ? "asked a question"
        : str(p.kind) === "suggestion"
          ? "made a suggestion"
          : "commented";
    case "topic.created":
      return `created the topic “${str(p.slug)}”`;
    case "person.registered":
      return "joined the archive";
    case "person.profile_updated":
      return "updated their profile";
    case "person.role_changed":
      return `role changed from ${str(p.from)} to ${str(p.to)}`;
    case "expertise.declared":
      return `declared expertise in ${str(p.topic)}`;
    case "expertise.revoked":
      return `withdrew expertise in ${str(p.topic)}`;
    case "moderation.hidden":
      return (
        <>
          hid content <q>{str(p.reason)}</q>
        </>
      );
    case "moderation.restored":
      return (
        <>
          restored content <q>{str(p.reason)}</q>
        </>
      );
    case "moderation.person_deactivated":
      return (
        <>
          deactivated an account <q>{str(p.reason)}</q>
        </>
      );
    case "moderation.person_reactivated":
      return (
        <>
          reactivated an account <q>{str(p.reason)}</q>
        </>
      );
    default:
      return action;
  }
}

export function ActivityItem({ entry, showIdea = true }: { entry: ActivityDto; showIdea?: boolean }) {
  const moderation = entry.action.startsWith("moderation.");
  return (
    <li className={cx(styles.item, moderation && styles.moderation)}>
      <span className={styles.dot} aria-hidden />
      <p className={styles.text}>
        {entry.actor ? (
          <PersonLink person={entry.actor} />
        ) : (
          <span className={styles.system}>An operator</span>
        )}{" "}
        {describe(entry.action, entry.payload)}
        {showIdea && entry.idea && (
          <>
            {" "}
            <span className={styles.on}>in</span>{" "}
            <Link to="/ideas/$idea" params={{ idea: entry.idea.slug }} className={styles.idea}>
              {entry.idea.title}
            </Link>
          </>
        )}
      </p>
      <TimeAgo iso={entry.occurredAt} className={styles.time} />
    </li>
  );
}

export function ActivityList({ children }: { children: ReactNode }) {
  return (
    <ol className={styles.list} role="list">
      {children}
    </ol>
  );
}
