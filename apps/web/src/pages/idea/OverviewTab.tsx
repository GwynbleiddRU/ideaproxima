import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
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
import { formatDateTime, formatNumber, formatPaddedNumber, percent } from "@/lib/format";
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
  const t = useMessage();
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
              <span className={styles.sectionNumber}>{formatPaddedNumber(i + 1)}</span>
              {vocabularyField("sections", key, "label", IDEA_SECTION_INFO[key].label)}
            </h2>
            <Markdown source={idea.sections[key]!} claims={claimsById} ideaSlug={idea.slug} />
          </section>
        ))}
        {missing.length > 0 && (
          <aside className={styles.missing} aria-label={t("idea.overview.missingLabel")}>
            <p className="eyebrow">
              {t("idea.overview.writtenProgress", { count: written.length, total: IDEA_SECTIONS.length })}
            </p>
            <ul className={styles.missingList} role="list">
              {missing.map((key) => (
                <li key={key}>{vocabularyField("sections", key, "label", IDEA_SECTION_INFO[key].label)}</li>
              ))}
            </ul>
            <p>{t("idea.overview.missingHelp")}</p>
            <ButtonLink to="/ideas/$idea/edit" params={{ idea: idea.slug }} size="sm">
              <PenLine /> {t("idea.overview.develop")}
            </ButtonLink>
          </aside>
        )}
      </div>
      <aside className={styles.rail} aria-label={t("idea.overview.signals")}>
        <QualityCard idea={idea} />
        <RailCard title={t("idea.overview.lifecycle")}>
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
  const t = useMessage();
  const { signals } = idea;
  const actions = useIdeaActions();
  const confident = IDEA_DIMENSIONS.filter((d) => isConfident(signals.ratings[d]));
  const early = IDEA_DIMENSIONS.filter((d) => !isConfident(signals.ratings[d]));
  const ratedByMe = (idea.viewer?.ratings.length ?? 0) > 0;
  return (
    <RailCard
      title={t("lensSignal.quality.label")}
      aside={
        <InfoTip label={t("idea.rating.methodLabel")}>
          <LocalizedText
            id="idea.rating.method"
            values={{
              minimum: MIN_RATINGS_FOR_CONFIDENCE,
              algorithm: signals.algorithm,
              date: signals.computedAt ? formatDateTime(signals.computedAt) : "",
              dated: signals.computedAt ? "yes" : "no",
            }}
            components={{ 0: <code /> }}
          />
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
          <p>{confident.length ? t("idea.rating.earlySome") : t("idea.rating.earlyAll")}</p>
          <ul role="list">
            {early.map((d) => (
              <li key={d}>
                <span>{vocabularyField("dimensions", d, "label", DIMENSIONS[d].label)}</span>
                <span className={styles.earlyCount}>
                  <Dots n={signals.ratings[d]?.n ?? 0} of={MIN_RATINGS_FOR_CONFIDENCE} />
                  <span className="visually-hidden">
                    {t("idea.rating.progress", {
                      count: signals.ratings[d]?.n ?? 0,
                      total: MIN_RATINGS_FOR_CONFIDENCE,
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p>{t("idea.rating.minimum", { count: MIN_RATINGS_FOR_CONFIDENCE })}</p>
        </div>
      )}
      {isConfident(signals.ratings.impact) && isConfident(signals.ratings.feasibility) && (
        <Quadrant impact={signals.ratings.impact!} feasibility={signals.ratings.feasibility!} />
      )}
      <Button size="sm" icon={<Gauge />} onClick={actions.evaluate}>
        {ratedByMe ? t("idea.rating.updateYours") : t("idea.rating.addYours")}
      </Button>
      <p className={styles.caption}>
        {t("idea.rating.summary", {
          count: signals.counts.evaluators,
          completeness: percent(signals.completeness),
        })}
      </p>
    </RailCard>
  );
}

const QUADRANTS = {
  visionary: ["idea.quadrant.visionary", "idea.quadrant.visionaryDescription"],
  near: ["idea.quadrant.near", "idea.quadrant.nearDescription"],
  incremental: ["idea.quadrant.incremental", "idea.quadrant.incrementalDescription"],
  longShot: ["idea.quadrant.longShot", "idea.quadrant.longShotDescription"],
} as const;

/** Where the idea sits between "visionary" and "ready": potential (up) against feasibility today (right). */
function Quadrant({ impact, feasibility }: { impact: RatingSummaryDto; feasibility: RatingSummaryDto }) {
  const t = useMessage();
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
        <b>{t(name)}</b>
        {t("idea.quadrant.reading", { reading: t(reading) })}
      </figcaption>
    </figure>
  );
}

function KnownCard({ idea, statuses }: { idea: IdeaDetail; statuses?: ClaimStatus[] }) {
  const t = useMessage();
  const counts = new Map<ClaimStatus, number>();
  for (const s of statuses ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
  const present = CLAIM_STATUSES.filter((s) => counts.has(s));
  const { counts: c } = idea.signals;
  return (
    <RailCard
      title={t("idea.layout.known")}
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
                <span className="tabular">{formatNumber(counts.get(s)!)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.caption}>{t("idea.overview.noClaims")}</p>
      )}
      <p className={styles.caption}>
        {c.evidence
          ? t("idea.overview.evidenceBalance", {
              count: c.evidence,
              supporting: c.evidenceSupporting,
              challenging: c.evidenceChallenging,
            })
          : t("idea.overview.noEvidence")}{" "}
        <Link to="/ideas/$idea/evidence" params={{ idea: idea.slug }} className={styles.cardLink}>
          {t("idea.tabs.evidence")} <ArrowRight size={13} aria-hidden />
        </Link>
      </p>
    </RailCard>
  );
}

/** The quick stances, as boxes the viewer can tick, with how many people share each. */
function PerspectivesCard({ idea }: { idea: IdeaDetail }) {
  const t = useMessage();
  const stance = useStance(idea);
  const gate = useAuthGate();
  const mine = new Set(idea.viewer?.stances ?? []);
  const toggle = (kind: StanceKind) => gate(() => stance.mutate({ kind, on: !mine.has(kind) }));
  return (
    <RailCard
      title={t("idea.overview.perspectives")}
      aside={
        <InfoTip label={t("idea.overview.perspectivesLabel")}>{t("idea.overview.perspectivesHelp")}</InfoTip>
      }
    >
      <div className={styles.perspectives} role="group" aria-label={t("idea.overview.yourPerspective")}>
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
              <span className={styles.perspectiveCount}>{formatNumber(p.count)}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.caption}>{t("idea.overview.perspectivesCaption")}</p>
    </RailCard>
  );
}

/** Stewards and the people offering to help or working on it — who to talk to about this idea. */
function PeopleCard({ idea }: { idea: IdeaDetail }) {
  const t = useMessage();
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
      title={t("idea.overview.people")}
      aside={<InfoTip label={t("idea.overview.stewardsLabel")}>{t("idea.overview.stewardsHelp")}</InfoTip>}
    >
      <ul className={styles.people} role="list">
        {idea.stewards.map((s) => (
          <li key={s.person.id}>
            <PersonLink person={s.person} avatar />
            <span className={styles.role}>
              {t("idea.overview.stewardRole", {
                role: t(`idea.overview.stewardRole.${s.role}`),
              })}
            </span>
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
        {t("idea.overview.helpToo")} <ArrowRight aria-hidden />
      </Button>
      {can.canSteward && (
        <form onSubmit={submit} className={styles.appoint}>
          <input
            className={control}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder={t("idea.overview.stewardPlaceholder")}
            aria-label={t("idea.overview.stewardHandle")}
            required
          />
          <Button type="submit" size="sm" retryError={appoint.error} loading={appoint.isPending}>
            {t("idea.overview.appoint")}
          </Button>
          <FormError error={appoint.error} />
        </form>
      )}
    </RailCard>
  );
}
