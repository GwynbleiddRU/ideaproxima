import { vocabularyField } from "@/lib/vocabulary";
import { useLocale } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, Gauge, PenLine } from "lucide-react";
import type { IdeaDetail, RatingSummaryDto } from "@ideaproxima/contracts";
import {
  CAPACITY_INFO,
  CLAIM_STATUSES,
  DIMENSIONS,
  IDEA_SECTION_INFO,
  IDEA_SECTIONS,
  STANCE_KIND_INFO,
  STANCE_KINDS,
  STEWARD_ROLE_INFO,
  type ClaimStatus,
  type StanceKind,
} from "@ideaproxima/domain";
import { useAppointSteward } from "@/api/ideas";
import { knowledgeQueries } from "@/api/knowledge";
import { signalQueries, useStance } from "@/api/signals";
import { useAuthGate } from "@/components/auth";
import { Markdown } from "@/components/Markdown";
import { PersonLink } from "@/components/meta";
import { isConfident, RatingMeter } from "@/components/Ratings";
import { StageProgress } from "@/components/Stage";
import { claimStatusColor, ClaimStatusBadge } from "@/components/status";
import { cx } from "@/lib/cx";
import { formatDateTime, percent } from "@/lib/format";
import { formatCount } from "@/locales/runtime";
import { IDEA_DIMENSIONS, MIN_RATINGS_FOR_CONFIDENCE } from "@/lib/vocabulary";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { control } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import { InfoTip } from "@/ui/InfoTip";
import { Dots } from "@/ui/Meter";
import { useIdeaActions } from "./actions";
import { useIdea, usePermissions } from "./use-idea";
import styles from "./OverviewTab.module.scss";

export function OverviewTab() {
  useLocale();
  const idea = useIdea();
  const claims = useQuery(knowledgeQueries.ideaClaims(idea.slug));
  const claimsById = useMemo(() => new Map((claims.data ?? []).map((c) => [c.id, c])), [claims.data]);
  const written = IDEA_SECTIONS.filter((key) => idea.sections[key]?.trim());
  const missing = IDEA_SECTIONS.filter((key) => !idea.sections[key]?.trim());

  return (
    <div className={styles.overview}>
      <div className={styles.narrative}>
        {written.map((key, i) => (
          <section key={key} id={key} className={styles.section} aria-labelledby={`${key}-title`}>
            <h2 id={`${key}-title`} className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>{String(i + 1).padStart(2, "0")}</span>
              {vocabularyField("sections", key, "label", IDEA_SECTION_INFO[key].label)}
            </h2>
            <Markdown source={idea.sections[key]!} claims={claimsById} ideaSlug={idea.slug} />
          </section>
        ))}
        {missing.length > 0 && (
          <aside className={styles.missing} aria-label="Not yet written">
            <p className="eyebrow">
              Not yet written · {written.length} of {IDEA_SECTIONS.length} sections done
            </p>
            <ul className={styles.missingList} role="list">
              {missing.map((key) => (
                <li key={key}>{vocabularyField("sections", key, "label", IDEA_SECTION_INFO[key].label)}</li>
              ))}
            </ul>
            <p>Speculation is allowed; incomplete ideas are welcome. Anyone can propose the missing parts.</p>
            <ButtonLink to="/ideas/$idea/edit" params={{ idea: idea.slug }} size="sm">
              <PenLine /> Help develop this idea
            </ButtonLink>
          </aside>
        )}
      </div>
      <aside className={styles.rail} aria-label="Signals">
        <QualityCard idea={idea} />
        <RailCard title="Lifecycle stage">
          <StageProgress idea={idea} />
        </RailCard>
        <KnownCard idea={idea} statuses={claims.data?.map((c) => c.derived.status)} />
        <PerspectivesCard idea={idea} />
        <PeopleCard idea={idea} />
      </aside>
    </div>
  );
}

function RailCard({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/**
 * Confident measures as meters; dimensions below the threshold folded into one "too early" note; and, when both
 * are confident, where potential meets feasibility.
 */
function QualityCard({ idea }: { idea: IdeaDetail }) {
  useLocale();
  const { signals } = idea;
  const actions = useIdeaActions();
  const confident = IDEA_DIMENSIONS.filter((d) => isConfident(signals.ratings[d]));
  const early = IDEA_DIMENSIONS.filter((d) => !isConfident(signals.ratings[d]));
  const ratedByMe = (idea.viewer?.ratings.length ?? 0) > 0;
  return (
    <RailCard
      title="Assessed quality"
      aside={
        <InfoTip>
          Means of independent ratings on separate dimensions — never combined into one score. The whisker
          shows how much raters disagree. Fewer than {MIN_RATINGS_FOR_CONFIDENCE} ratings is “too early to
          tell”. Computed by <code>{signals.algorithm}</code>
          {signals.computedAt ? ` (${formatDateTime(signals.computedAt)})` : ""}; a reputation-weighted method
          is planned and will be labelled.
        </InfoTip>
      }
    >
      {confident.length > 0 && (
        <div className={styles.meters}>
          {confident.map((d, i) => (
            <RatingMeter key={d} dimension={d} summary={signals.ratings[d]} accent={i === 0} />
          ))}
        </div>
      )}
      {early.length > 0 && (
        <div className={styles.early}>
          <p>{confident.length ? "Too early to tell" : "Too early to tell on every dimension"}</p>
          <ul role="list">
            {early.map((d) => (
              <li key={d}>
                <span>{vocabularyField("dimensions", d, "label", DIMENSIONS[d].label)}</span>
                <span className={styles.earlyCount}>
                  <Dots n={signals.ratings[d]?.n ?? 0} of={MIN_RATINGS_FOR_CONFIDENCE} />
                  <span className="visually-hidden">
                    {signals.ratings[d]?.n ?? 0} of {MIN_RATINGS_FOR_CONFIDENCE} evaluations
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p>{MIN_RATINGS_FOR_CONFIDENCE} evaluations make a measure.</p>
        </div>
      )}
      {isConfident(signals.ratings.impact) && isConfident(signals.ratings.feasibility) && (
        <Quadrant impact={signals.ratings.impact!} feasibility={signals.ratings.feasibility!} />
      )}
      <Button size="sm" icon={<Gauge />} onClick={actions.evaluate}>
        {ratedByMe ? "Update your evaluation" : "Add your evaluation"}
      </Button>
      <p className={styles.caption}>
        {formatCount("count.evaluator", signals.counts.evaluators)} · {percent(signals.completeness)} of
        sections written
      </p>
    </RailCard>
  );
}

const QUADRANTS = {
  visionary: ["Visionary", "High potential, far from feasible today."],
  near: ["Transformative and near", "High potential, and feasible soon."],
  incremental: ["Incremental", "Feasible, with modest potential."],
  longShot: ["Long shot", "Modest potential, far from feasible."],
} as const;

/** Where the idea sits between "visionary" and "ready": potential (up) against feasibility today (right). */
function Quadrant({ impact, feasibility }: { impact: RatingSummaryDto; feasibility: RatingSummaryDto }) {
  const high = impact.value >= 0.5;
  const near = feasibility.value >= 0.5;
  const [name, reading] = QUADRANTS[high ? (near ? "near" : "visionary") : near ? "incremental" : "longShot"];
  const S = 88;
  const x = 6 + feasibility.value * (S - 12);
  const y = S - 6 - impact.value * (S - 12);
  return (
    <figure className={styles.quad}>
      <svg viewBox={`0 0 ${S} ${S}`} aria-hidden>
        <rect x={0.5} y={0.5} width={S - 1} height={S - 1} rx={8} className={styles.quadFrame} />
        <path d={`M${S / 2} 4v${S - 8}M4 ${S / 2}h${S - 8}`} className={styles.quadAxis} />
        <path
          d={`M${x - feasibility.dispersion * S} ${y}h${2 * feasibility.dispersion * S}M${x} ${y - impact.dispersion * S}v${2 * impact.dispersion * S}`}
          className={styles.quadSpread}
        />
        <circle cx={x} cy={y} r={4.5} className={styles.quadPoint} />
      </svg>
      <figcaption>
        <b>{name}</b>
        {reading} Potential ↑, feasibility →.
      </figcaption>
    </figure>
  );
}

function KnownCard({ idea, statuses }: { idea: IdeaDetail; statuses?: ClaimStatus[] }) {
  const counts = new Map<ClaimStatus, number>();
  for (const s of statuses ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
  const present = CLAIM_STATUSES.filter((s) => counts.has(s));
  const { counts: c } = idea.signals;
  return (
    <RailCard
      title="What is known"
      aside={<span className={styles.caption}>{formatCount("count.claim", c.claims)}</span>}
    >
      {present.length ? (
        <>
          <div className={styles.stack} aria-hidden>
            {present.map((s) => (
              <span key={s} style={{ flexGrow: counts.get(s), background: claimStatusColor(s) }} />
            ))}
          </div>
          <ul className={styles.statusList} role="list">
            {present.map((s) => (
              <li key={s}>
                <ClaimStatusBadge status={s} />
                <span className="tabular">{counts.get(s)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.caption}>No claims recorded yet. Claims make an idea examinable.</p>
      )}
      <p className={styles.caption}>
        {c.evidence
          ? `${formatCount("count.source", c.evidence)}: ${c.evidenceSupporting} supporting, ${c.evidenceChallenging} challenging.`
          : "No evidence attached yet."}{" "}
        <Link to="/ideas/$idea/evidence" params={{ idea: idea.slug }} className={styles.cardLink}>
          Claims & evidence <ArrowRight size={13} aria-hidden />
        </Link>
      </p>
    </RailCard>
  );
}

/** The quick stances, as boxes the viewer can tick, with how many people share each. */
function PerspectivesCard({ idea }: { idea: IdeaDetail }) {
  useLocale();
  const stance = useStance(idea);
  const gate = useAuthGate();
  const mine = new Set(idea.viewer?.stances ?? []);
  const toggle = (kind: StanceKind) => gate(() => stance.mutate({ kind, on: !mine.has(kind) }));
  return (
    <RailCard
      title="Perspectives"
      aside={
        <InfoTip label="What are perspectives?">
          Quick stances anyone can take. They show what people care about and believe — attention, not quality
          — and never feed the assessed measures above.
        </InfoTip>
      }
    >
      <div className={styles.perspectives} role="group" aria-label="Your perspective">
        {STANCE_KINDS.map((kind) => {
          const p = idea.signals.perspectives[kind] ?? { count: 0, share: 0 };
          const on = mine.has(kind);
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              className={styles.perspective}
              title={vocabularyField("stanceKinds", kind, "description", STANCE_KIND_INFO[kind].description)}
              onClick={() => toggle(kind)}
            >
              <span className={cx(styles.box, on && styles.boxOn)} aria-hidden>
                {on && <Check />}
              </span>
              <span>{vocabularyField("stanceKinds", kind, "label", STANCE_KIND_INFO[kind].label)}</span>
              <span className={styles.bar} aria-hidden>
                <span style={{ width: percent(p.share) }} />
              </span>
              <span className={styles.perspectiveCount}>{p.count}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.caption}>Community judgments, not objective truth. Tick the ones you share.</p>
    </RailCard>
  );
}

/** Stewards and the people offering to help or working on it — who to talk to about this idea. */
function PeopleCard({ idea }: { idea: IdeaDetail }) {
  useLocale();
  const can = usePermissions(idea);
  const actions = useIdeaActions();
  const involvements = useQuery(signalQueries.involvements(idea.slug));
  const appoint = useAppointSteward(idea.slug);
  const [handle, setHandle] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    appoint.mutate({ handle: handle.trim() }, { onSuccess: () => setHandle("") });
  };
  const helpers = new Map<string, NonNullable<typeof involvements.data>>();
  for (const inv of involvements.data ?? [])
    if (inv.status !== "concluded") helpers.set(inv.person.id, [...(helpers.get(inv.person.id) ?? []), inv]);

  return (
    <RailCard
      title="People"
      aside={
        <InfoTip label="What do stewards do?">
          Stewards curate the narrative: they publish revisions directly and decide on proposed ones. Anyone
          can propose a revision; everything stays in the history.
        </InfoTip>
      }
    >
      <ul className={styles.people} role="list">
        {idea.stewards.map((s) => (
          <li key={s.person.id}>
            <PersonLink person={s.person} avatar />
            <span className={styles.role}>Steward · {STEWARD_ROLE_INFO[s.role].label.toLowerCase()}</span>
          </li>
        ))}
        {[...helpers.values()].map((invs) => (
          <li key={invs[0]!.person.id}>
            <PersonLink person={invs[0]!.person} avatar />
            <span className={styles.capacities}>
              {invs.map((inv) => (
                <Badge key={inv.capacity} tone={inv.status === "active" ? "success" : "primary"}>
                  {vocabularyField("capacities", inv.capacity, "label", CAPACITY_INFO[inv.capacity].label)}
                </Badge>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <Button variant="quiet" size="sm" className={styles.inlineAction} onClick={actions.involve}>
        I can help too <ArrowRight aria-hidden />
      </Button>
      {can.canSteward && (
        <form onSubmit={submit} className={styles.appoint}>
          <input
            className={control}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="Appoint a steward by handle"
            aria-label="Handle of the person to appoint as steward"
            required
          />
          <Button type="submit" size="sm" loading={appoint.isPending}>
            Appoint
          </Button>
          <FormError error={appoint.error} />
        </form>
      )}
    </RailCard>
  );
}
