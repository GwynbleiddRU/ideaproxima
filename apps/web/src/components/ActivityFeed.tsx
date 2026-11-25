import { vocabularyField } from "@/lib/vocabulary";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  FileText,
  Flag,
  Gauge,
  GitFork,
  HandHelping,
  Lightbulb,
  MessageSquare,
  Paperclip,
  PenLine,
  Rocket,
  Scale,
  Shield,
  Star,
  Tag,
  Target,
  User,
  type LucideIcon,
} from "lucide-react";
import type { ActivityDto, PersonRef } from "@ideaproxima/contracts";
import {
  CAPACITY_INFO,
  CLAIM_ROLE_INFO,
  IDEA_STAGE_INFO,
  INITIATIVE_STATUS_INFO,
  OUTCOME_RESULT_INFO,
  RELATION_TYPE_INFO,
  STANCE_KIND_INFO,
  type Capacity,
  type ClaimRole,
  type IdeaStage,
  type InitiativeStatus,
  type OutcomeResult,
  type RelationType,
  type StanceKind,
} from "@ideaproxima/domain";
import { cx } from "@/lib/cx";
import { foldActivity, type ActivityGroup } from "@/lib/activity";
import { clockTime, dayLabel, formatDateTime, isToday, shortAgo } from "@/lib/format";
import { formatCount } from "@/locales/runtime";
import { useLocale } from "@/locales/react";
import { dimensionLabel } from "@/lib/vocabulary";
import { PersonLink } from "./meta";
import styles from "./ActivityFeed.module.scss";

type Payload = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const lower = (s: string | undefined) => s?.toLowerCase() ?? "";

// ---------------------------------------------------------------- kinds of action

type Tone = "idea" | "knowledge" | "judgement" | "practice" | "debate" | "moderation" | "person";

/** An icon and a colour family per kind of action — always next to the sentence, never colour alone. */
function kindOf(action: string): [LucideIcon, Tone] {
  const [domain = ""] = action.split(".");
  if (action === "idea.proposed") return [Lightbulb, "idea"];
  if (action === "stage.changed") return [Flag, "practice"];
  if (action === "source.registered") return [BookOpen, "knowledge"];
  if (action === "outcome.recorded") return [Target, "practice"];
  const byDomain: Record<string, [LucideIcon, Tone]> = {
    revision: [PenLine, "idea"],
    steward: [User, "idea"],
    comment: [MessageSquare, "idea"],
    involvement: [HandHelping, "idea"],
    claim: [FileText, "knowledge"],
    evidence: [Paperclip, "knowledge"],
    relation: [GitFork, "knowledge"],
    argument: [Scale, "debate"],
    evaluation: [Gauge, "judgement"],
    stance: [Star, "judgement"],
    initiative: [Rocket, "practice"],
    moderation: [Shield, "moderation"],
    topic: [Tag, "person"],
  };
  return byDomain[domain] ?? [User, "person"];
}

// ---------------------------------------------------------------- sentences

/**
 * What happened, as the rest of a sentence after the actor ("moved Water-cleaning nanorobots to Tested"). `idea`
 * is the idea's link, "the idea" inside its own page, or null when the action concerns no idea. Every verb of the
 * ledger has a phrase; unknown verbs fall back to the raw action, so new backend verbs never break the feed.
 * Past-tense phrases read the same with one actor or several, which is what makes folding possible.
 */
function describe(e: ActivityDto, idea: ReactNode | null, count: number): ReactNode {
  if (e.subject.hidden) return "contributed content hidden by moderation";
  const p: Payload = e.payload;
  const subject = idea ?? "an idea";
  const on = (prep: string) =>
    idea ? (
      <>
        {" "}
        {prep} {idea}
      </>
    ) : null;
  const quote = (text: string) => (text ? <q>{text}</q> : null);
  const folded = count > 1;

  switch (e.action) {
    case "idea.proposed":
      return <>proposed {subject}</>;
    case "revision.published":
      return (
        <>
          published revision {String(p.number)}
          {on("of")} {quote(str(p.changeNote))}
        </>
      );
    case "revision.proposed":
      return (
        <>
          proposed revision {String(p.number)}
          {on("of")} {quote(str(p.changeNote))}
        </>
      );
    case "revision.accepted":
      return (
        <>
          accepted revision {String(p.number)}
          {on("of")}
        </>
      );
    case "revision.rejected":
      return (
        <>
          declined revision {String(p.number)}
          {on("of")}
        </>
      );
    case "revision.withdrawn":
      return (
        <>
          withdrew revision {String(p.number)}
          {on("of")}
        </>
      );
    case "stage.changed":
      return (
        <>
          moved {subject} to{" "}
          <b>
            {vocabularyField(
              "stages",
              p.to as IdeaStage,
              "label",
              IDEA_STAGE_INFO[p.to as IdeaStage]?.label,
            ) ?? str(p.to)}
          </b>
        </>
      );
    case "steward.appointed":
      return <>appointed a steward{on("for")}</>;
    case "claim.stated":
      return (
        <>
          stated a claim{on("on")}: {quote(str(p.statement))}
        </>
      );
    case "claim.linked":
      return (
        <>
          linked {folded ? formatCount("count.claim", count) : "a claim"} as{" "}
          {lower(
            vocabularyField(
              "claimRoles",
              p.role as ClaimRole,
              "label",
              CLAIM_ROLE_INFO[p.role as ClaimRole]?.label,
            ),
          )}
          {on("in")}
        </>
      );
    case "claim.unlinked":
      return <>unlinked a claim{on("from")}</>;
    case "evidence.attached": {
      const stance =
        str(p.stance) === "supports"
          ? "supporting"
          : str(p.stance) === "challenges"
            ? "challenging"
            : "mixed";
      return (
        <>
          attached {folded ? `${count} ${stance} sources` : `${stance} evidence`} to a claim{on("in")}
        </>
      );
    }
    case "evidence.withdrawn":
      return <>withdrew evidence{on("in")}</>;
    case "source.registered":
      return <>registered a source {quote(str(p.title))}</>;
    case "argument.made": {
      const target = str((p.target as Payload | undefined)?.kind);
      const verb =
        str(p.stance) === "supports"
          ? "argued for"
          : str(p.stance) === "opposes"
            ? "argued against"
            : "qualified";
      return (
        <>
          {verb}{" "}
          {target === "idea" || !target ? (
            subject
          ) : (
            <>
              a {target}
              {on("in")}
            </>
          )}
          : {quote(str(p.title))}
        </>
      );
    }
    case "argument.withdrawn":
      return <>withdrew an argument{on("on")}</>;
    case "evaluation.submitted": {
      const target = str((p.target as Payload | undefined)?.kind);
      const dims = list(p.dimensions).map((d) => lower(dimensionLabel(d)));
      if (target === "idea" || !target)
        return (
          <>
            evaluated {subject}
            {!folded && dims.length > 0 && ` on ${dims.join(", ")}`}
          </>
        );
      const what =
        target === "relation" ? "a connection" : target === "evidence" ? "evidence" : `a ${target}`;
      return (
        <>
          assessed {what}
          {on("in")}
        </>
      );
    }
    case "evaluation.withdrawn":
      return <>withdrew ratings{on("on")}</>;
    case "stance.taken":
      return (
        <>
          marked {subject}{" "}
          {lower(
            vocabularyField(
              "stanceKinds",
              p.kind as StanceKind,
              "label",
              STANCE_KIND_INFO[p.kind as StanceKind]?.label,
            ),
          ) || str(p.kind)}
        </>
      );
    case "stance.retracted":
      return <>retracted a perspective{on("on")}</>;
    case "involvement.declared": {
      const capacity =
        lower(
          vocabularyField(
            "capacities",
            p.capacity as Capacity,
            "label",
            CAPACITY_INFO[p.capacity as Capacity]?.label,
          ),
        ) || str(p.capacity);
      return str(p.status) === "active" ? (
        <>
          started working on {subject} ({capacity})
        </>
      ) : str(p.status) === "concluded" ? (
        <>concluded their involvement{on("in")}</>
      ) : (
        <>
          offered to help with <b>{capacity}</b>
          {on("on")}
        </>
      );
    }
    case "involvement.withdrawn":
      return <>ended their involvement{on("in")}</>;
    case "relation.proposed": {
      const type = RELATION_TYPE_INFO[p.type as RelationType];
      return (
        <>
          connected {subject} to another idea
          {type && ` (${vocabularyField("relationTypes", p.type as RelationType, "forward", type.forward)})`}
        </>
      );
    }
    case "relation.retracted":
      return <>retracted a connection{on("of")}</>;
    case "initiative.created":
      return (
        <>
          recorded an initiative{on("on")}: {quote(str(p.title))}
        </>
      );
    case "initiative.status_changed":
      return (
        <>
          marked an initiative{" "}
          {lower(
            vocabularyField(
              "initiativeStatuses",
              p.to as InitiativeStatus,
              "label",
              INITIATIVE_STATUS_INFO[p.to as InitiativeStatus]?.label,
            ),
          ) || str(p.to)}
          {on("on")}
        </>
      );
    case "outcome.recorded":
      return (
        <>
          recorded an outcome —{" "}
          <b>
            {lower(
              vocabularyField(
                "outcomeResults",
                p.result as OutcomeResult,
                "label",
                OUTCOME_RESULT_INFO[p.result as OutcomeResult]?.label,
              ),
            ) || str(p.result)}
          </b>
          {p.hasLessons ? ", with lessons" : ""}
          {on("for")}
        </>
      );
    case "comment.posted": {
      const kind = str(p.kind);
      const what =
        kind === "question"
          ? folded
            ? "asked questions"
            : "asked a question"
          : kind === "suggestion"
            ? folded
              ? "made suggestions"
              : "made a suggestion"
            : "commented";
      return (
        <>
          {what}
          {on("on")}
        </>
      );
    }
    case "topic.created":
      return <>created the topic “{str(p.slug)}”</>;
    case "topic.translation_updated":
      return (
        <>
          updated the {str(p.locale)} translation of “{str(p.slug)}”
        </>
      );
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
          hid content{on("in")} — {quote(str(p.reason))}
        </>
      );
    case "moderation.restored":
      return (
        <>
          restored content{on("in")} — {quote(str(p.reason))}
        </>
      );
    case "moderation.person_deactivated":
      return <>deactivated an account — {quote(str(p.reason))}</>;
    case "moderation.person_reactivated":
      return <>reactivated an account — {quote(str(p.reason))}</>;
    default:
      return (
        <>
          {e.action}
          {on("in")}
        </>
      );
  }
}

// ---------------------------------------------------------------- actors

/** "Ana", "Ana and Idris", "Ana, Idris and Sun", or "Ana, Idris and 4 others" (expandable). */
function Actors({ entries }: { entries: ActivityDto[] }) {
  const [open, setOpen] = useState(false);
  const people: (PersonRef | null)[] = [
    ...new Map(entries.map((e) => [e.actor?.id ?? "", e.actor])).values(),
  ];
  const shown = open || people.length <= 3 ? people : people.slice(0, 2);
  const rest = people.length - shown.length;
  return (
    <>
      {shown.map((p, i) => (
        <span key={p?.id ?? "operator"}>
          {i > 0 && (rest === 0 && i === shown.length - 1 ? " and " : ", ")}
          {p ? <PersonLink person={p} /> : <b>An operator</b>}
        </span>
      ))}
      {rest > 0 && (
        <>
          {" and "}
          <button type="button" className={styles.more} onClick={() => setOpen(true)}>
            {rest} others
          </button>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- the feed

/**
 * The activity ledger as readable events: an icon per kind of action, repeats folded, and — for longer feeds —
 * day headings. `showIdea` false renders "the idea" (inside an idea's own history); `showActor` false drops the
 * actor (a person's own profile).
 */
export function ActivityFeed({
  entries,
  showIdea = true,
  showActor = true,
  byDay = false,
  dayHeading: DayHeading = "h3",
  max,
}: {
  entries: ActivityDto[];
  showIdea?: boolean;
  showActor?: boolean;
  byDay?: boolean;
  dayHeading?: "h2" | "h3";
  /** Show at most this many lines (after folding), for compact previews of the record. */
  max?: number;
}) {
  useLocale();
  const groups = foldActivity(entries).slice(0, max);
  if (!byDay)
    return (
      <ol className={styles.feed}>
        {groups.map((g) => (
          <Entry key={g.key} group={g} {...{ showIdea, showActor, byDay }} />
        ))}
      </ol>
    );

  const days: { label: string; groups: ActivityGroup[] }[] = [];
  for (const g of groups) {
    const label = dayLabel(g.entries[0]!.occurredAt);
    if (days.at(-1)?.label === label) days.at(-1)!.groups.push(g);
    else days.push({ label, groups: [g] });
  }
  return (
    <div className={styles.days}>
      {days.map((day) => (
        <section key={day.label} aria-label={day.label}>
          <DayHeading className={styles.day}>{day.label}</DayHeading>
          <ol className={styles.feed}>
            {day.groups.map((g) => (
              <Entry key={g.key} group={g} {...{ showIdea, showActor, byDay }} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Entry({
  group,
  showIdea,
  showActor,
  byDay,
}: {
  group: ActivityGroup;
  showIdea: boolean;
  showActor: boolean;
  byDay: boolean;
}) {
  const first = group.entries[0]!;
  const [Icon, tone] = kindOf(first.action);
  const idea = !showIdea ? (
    "the idea"
  ) : first.idea ? (
    <Link to="/ideas/$idea" params={{ idea: first.idea.slug }} className={styles.ideaLink}>
      {first.idea.title}
    </Link>
  ) : null;
  const when = first.occurredAt;
  return (
    <li className={styles.entry}>
      <span className={cx(styles.icon, styles[tone])} aria-hidden>
        <Icon />
      </span>
      <p className={cx(styles.what, !showActor && styles.capital)}>
        {showActor && (
          <>
            <Actors entries={group.entries} />{" "}
          </>
        )}
        {describe(first, idea, group.entries.length)}
      </p>
      <time dateTime={when} title={formatDateTime(when)} className={styles.time}>
        {byDay && !isToday(when) ? clockTime(when) : shortAgo(when)}
      </time>
    </li>
  );
}
