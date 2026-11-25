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
import {
  clockTime,
  dayLabel,
  formatDateTime,
  formatList,
  formatListParts,
  isToday,
  shortAgo,
} from "@/lib/format";
import { message } from "@/locales/runtime";
import type { MessageId } from "@/locales/messages";
import type { Values } from "@lingui/core";
import { LocalizedText, useMessage } from "@/locales/react";
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

const targetKind = (p: Payload) => str((p.target as Payload | undefined)?.kind) || "idea";

/** Keep the ledger verbs and linked subjects in one message so translators can move them together. */
function describe(e: ActivityDto, idea: ReactNode, count: number): ReactNode {
  if (e.subject.hidden) return <LocalizedText id="activity.hidden" />;
  const p = e.payload;
  const line = (
    id: MessageId,
    values: Values = {},
    { quote, emphasis }: { quote?: string; emphasis?: boolean } = {},
  ) => (
    <LocalizedText
      id={id}
      values={{ count, hasIdea: idea ? "yes" : "no", hasQuote: quote ? "yes" : "no", ...values }}
      components={{
        0: <bdi>{idea ?? message("activity.anIdea")}</bdi>,
        1: emphasis ? <b /> : <q dir="auto">{quote}</q>,
      }}
    />
  );
  const revision = (quote?: string) => [{ number: p.number }, { quote }] as const;
  switch (e.action) {
    case "idea.proposed":
      return line("activity.idea.proposed");
    case "revision.published":
      return line("activity.revision.published", ...revision(str(p.changeNote)));
    case "revision.proposed":
      return line("activity.revision.proposed", ...revision(str(p.changeNote)));
    case "revision.accepted":
      return line("activity.revision.accepted", ...revision());
    case "revision.rejected":
      return line("activity.revision.rejected", ...revision());
    case "revision.withdrawn":
      return line("activity.revision.withdrawn", ...revision());
    case "stage.changed":
      return line(
        "activity.stage.changed",
        {
          stage:
            vocabularyField(
              "stages",
              p.to as IdeaStage,
              "label",
              IDEA_STAGE_INFO[p.to as IdeaStage]?.label,
            ) ?? str(p.to),
        },
        { emphasis: true },
      );
    case "steward.appointed":
      return line("activity.steward.appointed");
    case "claim.stated":
      return line("activity.claim.stated", {}, { quote: str(p.statement) });
    case "claim.linked":
      return line("activity.claim.linked", {
        role:
          lower(
            vocabularyField(
              "claimRoles",
              p.role as ClaimRole,
              "label",
              CLAIM_ROLE_INFO[p.role as ClaimRole]?.label,
            ),
          ) || str(p.role),
      });
    case "claim.unlinked":
      return line("activity.claim.unlinked");
    case "evidence.attached":
      return line("activity.evidence.attached", { stance: str(p.stance) });
    case "evidence.withdrawn":
      return line("activity.evidence.withdrawn");
    case "source.registered":
      return line("activity.source.registered", {}, { quote: str(p.title) });
    case "argument.made":
      return line(
        "activity.argument.made",
        { target: targetKind(p), stance: str(p.stance) },
        { quote: str(p.title) },
      );
    case "argument.withdrawn":
      return line("activity.argument.withdrawn");
    case "evaluation.submitted": {
      const target = targetKind(p);
      if (target !== "idea") return line("activity.evaluation.target", { target });
      const dimensions =
        count === 1 ? formatList(list(p.dimensions).map((d) => lower(dimensionLabel(d)))) : "";
      return line("activity.evaluation.idea", { dimensions, hasDimensions: dimensions ? "yes" : "no" });
    }
    case "evaluation.withdrawn":
      return line("activity.evaluation.withdrawn");
    case "stance.taken":
      return line("activity.stance.taken", {
        stance:
          lower(
            vocabularyField(
              "stanceKinds",
              p.kind as StanceKind,
              "label",
              STANCE_KIND_INFO[p.kind as StanceKind]?.label,
            ),
          ) || str(p.kind),
      });
    case "stance.retracted":
      return line("activity.stance.retracted");
    case "involvement.declared":
      return line(
        "activity.involvement.declared",
        {
          status: str(p.status),
          capacity:
            lower(
              vocabularyField(
                "capacities",
                p.capacity as Capacity,
                "label",
                CAPACITY_INFO[p.capacity as Capacity]?.label,
              ),
            ) || str(p.capacity),
        },
        { emphasis: true },
      );
    case "involvement.withdrawn":
      return line("activity.involvement.withdrawn");
    case "relation.proposed": {
      const type = RELATION_TYPE_INFO[p.type as RelationType];
      return line("activity.relation.proposed", {
        type: type ? vocabularyField("relationTypes", p.type as RelationType, "forward", type.forward) : "",
        hasType: type ? "yes" : "no",
      });
    }
    case "relation.retracted":
      return line("activity.relation.retracted");
    case "initiative.created":
      return line("activity.initiative.created", {}, { quote: str(p.title) });
    case "initiative.status_changed":
      return line("activity.initiative.status_changed", {
        status:
          lower(
            vocabularyField(
              "initiativeStatuses",
              p.to as InitiativeStatus,
              "label",
              INITIATIVE_STATUS_INFO[p.to as InitiativeStatus]?.label,
            ),
          ) || str(p.to),
      });
    case "outcome.recorded":
      return line(
        "activity.outcome.recorded",
        {
          result:
            lower(
              vocabularyField(
                "outcomeResults",
                p.result as OutcomeResult,
                "label",
                OUTCOME_RESULT_INFO[p.result as OutcomeResult]?.label,
              ),
            ) || str(p.result),
          lessons: p.hasLessons ? "yes" : "no",
        },
        { emphasis: true },
      );
    case "comment.posted":
      return line("activity.comment.posted", { kind: str(p.kind) });
    case "topic.created":
      return line("activity.topic.created", { topic: str(p.slug) });
    case "topic.translation_updated":
      return line("activity.topic.translation_updated", { locale: str(p.locale), topic: str(p.slug) });
    case "person.registered":
      return line("activity.person.registered");
    case "person.profile_updated":
      return line("activity.person.profile_updated");
    case "person.role_changed":
      return line("activity.person.role_changed", { from: str(p.from), to: str(p.to) });
    case "expertise.declared":
      return line("activity.expertise.declared", { topic: str(p.topic) });
    case "expertise.revoked":
      return line("activity.expertise.revoked", { topic: str(p.topic) });
    case "moderation.hidden":
      return line("activity.moderation.hidden", {}, { quote: str(p.reason) });
    case "moderation.restored":
      return line("activity.moderation.restored", {}, { quote: str(p.reason) });
    case "moderation.person_deactivated":
      return line("activity.moderation.person_deactivated", {}, { quote: str(p.reason) });
    case "moderation.person_reactivated":
      return line("activity.moderation.person_reactivated", {}, { quote: str(p.reason) });
    default:
      return line("activity.unknown", { action: e.action });
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
  const actors = shown.map((person) =>
    person ? (
      <PersonLink person={person} />
    ) : (
      <b>
        <LocalizedText id="activity.operator" />
      </b>
    ),
  );
  if (rest > 0)
    actors.push(
      <button type="button" className={styles.more} onClick={() => setOpen(true)}>
        <LocalizedText id="activity.otherActors" values={{ count: rest }} />
      </button>,
    );
  return formatListParts(actors.map((_, index) => String(index))).map(({ type, value }, index) =>
    type === "literal" ? value : <span key={index}>{actors[Number(value)]}</span>,
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
  useMessage();
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
    message("activity.theIdea")
  ) : first.idea ? (
    <Link to="/ideas/$idea" params={{ idea: first.idea.slug }} className={styles.ideaLink} dir="auto">
      {first.idea.title}
    </Link>
  ) : null;
  const when = first.occurredAt;
  const description = describe(first, idea, group.entries.length);
  return (
    <li className={styles.entry}>
      <span className={cx(styles.icon, styles[tone])} aria-hidden>
        <Icon />
      </span>
      <p className={cx(styles.what, !showActor && styles.capital)}>
        {showActor ? (
          <LocalizedText
            id="activity.withActors"
            components={{
              0: (
                <span>
                  <Actors entries={group.entries} />
                </span>
              ),
              1: <span>{description}</span>,
            }}
          />
        ) : (
          description
        )}
      </p>
      <time dateTime={when} title={formatDateTime(when)} className={styles.time}>
        {byDay && !isToday(when) ? clockTime(when) : shortAgo(when)}
      </time>
    </li>
  );
}
