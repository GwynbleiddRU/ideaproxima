import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, PenLine } from "lucide-react";
import type { IdeaDetail, RatingSummaryDto } from "@ideaproxima/contracts";
import {
  CLAIM_STATUSES,
  IDEA_SECTION_INFO,
  IDEA_SECTIONS,
  STANCE_KIND_INFO,
  STANCE_KINDS,
  STEWARD_ROLE_INFO,
  type ClaimStatus,
} from "@ideaproxima/domain";
import { useAppointSteward } from "@/api/ideas";
import { knowledgeQueries } from "@/api/knowledge";
import { Markdown } from "@/components/Markdown";
import { PersonLink } from "@/components/meta";
import { RatingMeter } from "@/components/Ratings";
import { StageTrack } from "@/components/Stage";
import { ClaimStatusBadge } from "@/components/status";
import { cx } from "@/lib/cx";
import { formatDateTime, percent } from "@/lib/format";
import { IDEA_DIMENSIONS, MIN_RATINGS_FOR_CONFIDENCE } from "@/lib/vocabulary";
import { Button, ButtonLink } from "@/ui/Button";
import { control } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import { InfoTip } from "@/ui/InfoTip";
import { useIdea, usePermissions } from "./use-idea";
import styles from "./OverviewTab.module.scss";

export function OverviewTab() {
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
              {IDEA_SECTION_INFO[key].label}
            </h2>
            <Markdown source={idea.sections[key]!} claims={claimsById} ideaSlug={idea.slug} />
          </section>
        ))}
        {missing.length > 0 && (
          <aside className={styles.missing}>
            <p className="eyebrow">Not yet written</p>
            <p>
              {missing.map((key) => IDEA_SECTION_INFO[key].label).join(" · ")}. Speculation is allowed;
              incomplete ideas are welcome. Anyone can help develop them.
            </p>
            <ButtonLink to="/ideas/$idea/edit" params={{ idea: idea.slug }} size="sm">
              <PenLine /> Help develop this idea
            </ButtonLink>
          </aside>
        )}
      </div>
      <aside className={styles.rail} aria-label="Signals">
        <QualityCard idea={idea} />
        <ClaimsCard idea={idea} statuses={claims.data?.map((c) => c.derived.status)} />
        <RailCard title="Lifecycle stage">
          <StageTrack idea={idea} />
        </RailCard>
        <PerspectivesCard idea={idea} />
        <StewardsCard idea={idea} />
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

function QualityCard({ idea }: { idea: IdeaDetail }) {
  const { signals } = idea;
  return (
    <RailCard
      title="Assessed quality"
      aside={
        <InfoTip>
          Means of independent ratings on separate dimensions; the whisker shows how much raters disagree.
          Fewer than {MIN_RATINGS_FOR_CONFIDENCE} ratings is “too early to tell”. Computed by{" "}
          <code>{signals.algorithm}</code>
          {signals.computedAt ? ` (${formatDateTime(signals.computedAt)})` : ""}; a reputation-weighted method
          is planned and will be labelled.
        </InfoTip>
      }
    >
      <div className={styles.meters}>
        {IDEA_DIMENSIONS.map((d, i) => (
          <RatingMeter key={d} dimension={d} summary={signals.ratings[d]} accent={i === 0} />
        ))}
      </div>
      <PotentialFeasibility impact={signals.ratings.impact} feasibility={signals.ratings.feasibility} />
      <p className={styles.caption}>
        {signals.counts.evaluators} evaluators · {percent(signals.completeness)} of sections written · never
        combined into one score
      </p>
    </RailCard>
  );
}

/** Where the idea sits between "visionary" and "ready": potential (y) against feasibility today (x). */
function PotentialFeasibility({
  impact,
  feasibility,
}: {
  impact?: RatingSummaryDto;
  feasibility?: RatingSummaryDto;
}) {
  if (!impact || !feasibility) return null;
  const early = impact.n < MIN_RATINGS_FOR_CONFIDENCE || feasibility.n < MIN_RATINGS_FOR_CONFIDENCE;
  const S = 200;
  const x = feasibility.value * S;
  const y = S - impact.value * S;
  return (
    <figure className={styles.plot}>
      <svg
        viewBox={`-1 -16 ${S + 2} ${S + 32}`}
        role="img"
        aria-label={`Potential ${percent(impact.value)}, feasibility ${percent(feasibility.value)}`}
      >
        <rect x={0} y={0} width={S} height={S} className={styles.plotFrame} />
        <line x1={S / 2} y1={0} x2={S / 2} y2={S} className={styles.plotAxis} />
        <line x1={0} y1={S / 2} x2={S} y2={S / 2} className={styles.plotAxis} />
        <text x={0} y={-5}>
          Visionary
        </text>
        <text x={S} y={-5} textAnchor="end">
          Transformative, near
        </text>
        <text x={0} y={S + 12}>
          Long shot
        </text>
        <text x={S} y={S + 12} textAnchor="end">
          Incremental
        </text>
        <line
          x1={x - feasibility.dispersion * S}
          y1={y}
          x2={x + feasibility.dispersion * S}
          y2={y}
          className={styles.plotSpread}
        />
        <line
          x1={x}
          y1={y - impact.dispersion * S}
          x2={x}
          y2={y + impact.dispersion * S}
          className={styles.plotSpread}
        />
        <circle cx={x} cy={y} r={6} className={cx(styles.plotPoint, early && styles.plotEarly)} />
      </svg>
      <figcaption>Potential ↑ · feasibility today →{early ? " · too early to tell" : ""}</figcaption>
    </figure>
  );
}

function ClaimsCard({ idea, statuses }: { idea: IdeaDetail; statuses?: ClaimStatus[] }) {
  const counts = new Map<ClaimStatus, number>();
  for (const s of statuses ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
  const { counts: c } = idea.signals;
  return (
    <RailCard title="What is known">
      {statuses?.length ? (
        <ul className={styles.statusList} role="list">
          {CLAIM_STATUSES.filter((s) => counts.has(s)).map((s) => (
            <li key={s}>
              <ClaimStatusBadge status={s} />
              <span className="tabular">{counts.get(s)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.caption}>No claims recorded yet. Claims make an idea examinable.</p>
      )}
      <p className={styles.caption}>
        {c.evidence} pieces of evidence: {c.evidenceSupporting} supporting, {c.evidenceChallenging}{" "}
        challenging.
      </p>
      <Link to="/ideas/$idea/evidence" params={{ idea: idea.slug }} className={styles.cardLink}>
        Claims & evidence <ArrowRight size={14} aria-hidden />
      </Link>
    </RailCard>
  );
}

function PerspectivesCard({ idea }: { idea: IdeaDetail }) {
  const { perspectives, attention } = idea.signals;
  return (
    <RailCard
      title="Community perspective"
      aside={
        <InfoTip label="What are perspectives?">
          Quick stances anyone can take. They show what people care about and believe at a glance — attention,
          not quality — and are never folded into the assessed measures above.
        </InfoTip>
      }
    >
      <ul className={styles.perspectives} role="list">
        {STANCE_KINDS.map((kind) => {
          const p = perspectives[kind] ?? { count: 0, share: 0 };
          return (
            <li key={kind}>
              <span>{STANCE_KIND_INFO[kind].label}</span>
              <span className={styles.bar} aria-hidden>
                <span style={{ width: percent(p.share) }} />
              </span>
              <span className="tabular">{p.count}</span>
            </li>
          );
        })}
      </ul>
      <p className={styles.caption}>
        {attention} people find it important. Community judgments, not objective truth.
      </p>
    </RailCard>
  );
}

function StewardsCard({ idea }: { idea: IdeaDetail }) {
  const can = usePermissions(idea);
  const appoint = useAppointSteward(idea.slug);
  const [handle, setHandle] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    appoint.mutate({ handle: handle.trim() }, { onSuccess: () => setHandle("") });
  };
  return (
    <RailCard
      title="Stewards"
      aside={
        <InfoTip label="What do stewards do?">
          Stewards curate the narrative: they publish revisions directly and decide on proposed ones. Anyone
          can propose a revision; everything stays in the history.
        </InfoTip>
      }
    >
      <ul className={styles.stewards} role="list">
        {idea.stewards.map((s) => (
          <li key={s.person.id}>
            <PersonLink person={s.person} avatar />
            <span className={styles.caption}>{STEWARD_ROLE_INFO[s.role].label}</span>
          </li>
        ))}
      </ul>
      {can.canSteward && (
        <form onSubmit={submit} className={styles.appoint}>
          <input
            className={control}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="Appoint by handle"
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
