import { LocalizedText, useMessage } from "@/locales/react";
import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ChevronRight, Flag, Gauge, HandHelping, PenLine, Star } from "lucide-react";
import type { IdeaDetail, RatingSummaryDto } from "@ideaproxima/contracts";
import { IDEA_STAGES, STANCE_KIND_INFO, stageOrdinal, type DimensionKey } from "@ideaproxima/domain";
import { useTopicNames } from "@/api/catalog";
import { useStance } from "@/api/signals";
import { useAuthGate } from "@/components/auth";
import { PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { isConfident, nearestAnchor } from "@/components/Ratings";
import { StageBadge } from "@/components/Stage";
import { cx } from "@/lib/cx";
import { formatCount } from "@/locales/runtime";
import { useScrolledPast } from "@/lib/hooks";
import { dimensionLabel, MIN_RATINGS_FOR_CONFIDENCE, useVocabulary, vocabularyField } from "@/lib/vocabulary";
import { formatDecimal, formatNumber } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { Dots } from "@/ui/Meter";
import { IdeaActionsProvider, useIdeaActions } from "./actions";
import { useIdea, usePermissions } from "./use-idea";
import styles from "./IdeaLayout.module.scss";

export function IdeaLayout() {
  const t = useMessage();
  const idea = useIdea();
  const topicNames = useTopicNames();
  const param = useParams({ from: "/ideas/$idea", select: (p) => p.idea });
  const navigate = useNavigate();
  const title = useRef<HTMLHeadingElement>(null);
  const scrolled = useScrolledPast(title);

  // One canonical URL per idea: an id in the address becomes the slug.
  useEffect(() => {
    if (param !== idea.slug) void navigate({ to: ".", params: { idea: idea.slug }, replace: true });
  }, [param, idea.slug, navigate]);

  return (
    <IdeaActionsProvider idea={idea}>
      <article>
        <title>{t("idea.layout.documentTitle", { title: idea.title })}</title>
        <meta name="description" content={idea.summary} />
        <header className={cx("container", styles.header)}>
          <nav className={styles.crumbs} aria-label={t("idea.layout.breadcrumb")}>
            <Link to="/explore">{t("nav.explore")}</Link>
            {idea.topics.map((topic) => (
              <span key={topic.id} className={styles.crumb}>
                <ChevronRight aria-hidden />
                <Link to="/topics/$slug" params={{ slug: topic.slug }}>
                  {topicNames?.get(topic.slug) ?? topic.name}
                </Link>
              </span>
            ))}
          </nav>
          {idea.hidden && (
            <p className={styles.hiddenBanner} role="status">
              {t("idea.layout.hidden")}
            </p>
          )}
          <div className={styles.badges}>
            <StageBadge stage={idea.stage} />
            {idea.pendingRevisionProposals > 0 && (
              <Badge tone="warning">{formatCount("count.revision", idea.pendingRevisionProposals)}</Badge>
            )}
          </div>
          <h1 ref={title} className={styles.title} dir="auto">
            {idea.title}
          </h1>
          <p className={styles.summary} dir="auto">
            {idea.summary}
          </p>
          <div className={styles.meta}>
            <span>
              <Avatar name={idea.proposedBy.displayName} seed={idea.proposedBy.handle} size={22} />
              <LocalizedText
                id="idea.meta.proposedBy"
                components={{ 0: <PersonLink person={idea.proposedBy} /> }}
              />
            </span>
            <span>
              <LocalizedText
                id={
                  idea.revision.author.id === idea.proposedBy.id
                    ? "idea.layout.revision"
                    : "idea.layout.revisionBy"
                }
                values={{ number: idea.revision.number }}
                components={{
                  0: <TimeAgo iso={idea.updatedAt} />,
                  1: <PersonLink person={idea.revision.author} />,
                }}
              />
            </span>
            <span className={styles.wide}>
              {formatCount("count.contributor", idea.signals.counts.contributors)}
            </span>
            {idea.tags.length > 0 && (
              <span className={cx(styles.tags, styles.wide)}>
                {idea.tags.map((tag) => (
                  <Link key={tag} to="/explore" search={{ tag }} className={styles.tag}>
                    {`#${tag}`}
                  </Link>
                ))}
              </span>
            )}
          </div>
          <Glance idea={idea} />
          <ActionBar idea={idea} />
        </header>
        <IdeaTabs idea={idea} compact={scrolled} />
        <div className={cx("container", styles.content)}>
          <Outlet />
        </div>
      </article>
    </IdeaActionsProvider>
  );
}

/** Phones and tablets: the sidebar's essentials under the summary, before the long text. */
function Glance({ idea }: { idea: IdeaDetail }) {
  const t = useMessage();
  const vocabulary = useVocabulary();
  const { ratings, counts } = idea.signals;
  const measure = (d: DimensionKey, label: string, summary: RatingSummaryDto | undefined) => (
    <div>
      <span>{label}</span>
      {summary && isConfident(summary) ? (
        <>
          <b>{nearestAnchor(d, summary.mean)}</b>
          <span>
            {t("idea.rating.meanAndCount", { mean: formatDecimal(summary.mean), count: summary.n })}
          </span>
        </>
      ) : (
        <>
          <b className={styles.early}>{t("idea.rating.early")}</b>
          <span className={styles.dots}>
            <Dots n={summary?.n ?? 0} of={MIN_RATINGS_FOR_CONFIDENCE} />{" "}
            {t("common.progress", { count: summary?.n ?? 0, total: MIN_RATINGS_FOR_CONFIDENCE })}
          </span>
        </>
      )}
    </div>
  );
  const ordinal = stageOrdinal(idea.stage);
  return (
    <div className={styles.glance} aria-label={t("idea.layout.glance")} role="group" tabIndex={0}>
      {measure("impact", dimensionLabel("impact"), ratings.impact)}
      {measure("feasibility", dimensionLabel("feasibility"), ratings.feasibility)}
      <div>
        <span>{t("idea.layout.known")}</span>
        <b>{formatCount("count.claim", counts.claims)}</b>
        <span>
          {counts.evidence ? formatCount("count.source", counts.evidence) : t("idea.layout.noEvidence")}
        </span>
      </div>
      <div>
        <span>{t("idea.stage")}</span>
        <b>{vocabulary.stage(idea.stage).label}</b>
        <span>{t("common.progress", { count: ordinal + 1, total: IDEA_STAGES.length })}</span>
      </div>
    </div>
  );
}

/** "Important": the attention signal. Set apart from the quality actions, never among them. */
function ImportantToggle({ idea }: { idea: IdeaDetail }) {
  const t = useMessage();
  const stance = useStance(idea);
  const gate = useAuthGate();
  const on = !!idea.viewer?.stances.includes("important");
  const count = idea.signals.perspectives.important?.count ?? idea.signals.attention;
  return (
    <Button
      size="sm"
      className={cx(styles.important, on && styles.importantOn)}
      aria-pressed={on}
      title={t("idea.action.importantHint")}
      onClick={() => gate(() => stance.mutate({ kind: "important", on: !on }))}
    >
      <Star aria-hidden />
      <span className={styles.wideLabel}>
        {vocabularyField("stanceKinds", "important", "label", STANCE_KIND_INFO.important.label)}
      </span>
      <span className={styles.count}>{formatNumber(count)}</span>
    </Button>
  );
}

function ActionBar({ idea }: { idea: IdeaDetail }) {
  const t = useMessage();
  const can = usePermissions(idea);
  const actions = useIdeaActions();
  const ratedByMe = (idea.viewer?.ratings.length ?? 0) > 0;
  const editLabel = can.canSteward ? t("idea.action.edit") : t("idea.action.suggestEdit");
  return (
    <div className={styles.actions}>
      <Button variant="primary" size="sm" icon={<Gauge />} onClick={actions.evaluate}>
        {ratedByMe ? t("idea.action.updateEvaluation") : t("idea.action.evaluate")}
      </Button>
      <Button size="sm" icon={<HandHelping />} onClick={actions.involve}>
        {t("idea.action.help")}
      </Button>
      <ButtonLink
        to="/ideas/$idea/edit"
        params={{ idea: idea.slug }}
        size="sm"
        variant="secondary"
        aria-label={editLabel}
      >
        <PenLine aria-hidden />
        <span className={styles.wideLabel}>{editLabel}</span>
      </ButtonLink>
      {can.canSteward && (
        <Button size="sm" variant="ghost" icon={<Flag />} onClick={actions.changeStage}>
          {t("idea.stage")}
        </Button>
      )}
      <ModerateButton kind="idea" id={idea.id} hidden={idea.hidden} />
      <span className={styles.grow} />
      <ImportantToggle idea={idea} />
    </div>
  );
}

function IdeaTabs({ idea, compact }: { idea: IdeaDetail; compact: boolean }) {
  const t = useMessage();
  const { counts } = idea.signals;
  const actions = useIdeaActions();
  const params = { idea: idea.slug };
  const tabs = [
    { to: "/ideas/$idea", label: "idea.tabs.overview", exact: true },
    { to: "/ideas/$idea/evidence", label: "idea.tabs.evidence", count: counts.claims },
    {
      to: "/ideas/$idea/discussion",
      label: "idea.tabs.discussion",
      count: counts.arguments + counts.comments,
    },
    { to: "/ideas/$idea/connections", label: "idea.tabs.connections" },
    { to: "/ideas/$idea/practice", label: "idea.tabs.practice", count: counts.initiatives },
    {
      to: "/ideas/$idea/history",
      label: "idea.tabs.history",
      count: idea.pendingRevisionProposals || undefined,
    },
  ] as const;
  return (
    <nav className={cx(styles.tabsBar, compact && styles.compact)} aria-label={t("idea.tabs.label")}>
      <div className={cx("container", styles.tabsInner)}>
        {/* Once the page title has scrolled away, the bar names the idea and keeps its main action. */}
        <span className={styles.miniTitle} aria-hidden>
          {idea.title}
        </span>
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={params}
              activeOptions={{ exact: "exact" in tab }}
              className={styles.tab}
              resetScroll={false}
            >
              {t(tab.label)}
              {"count" in tab && tab.count !== undefined && tab.count > 0 && (
                <span className={styles.tabCount}>{formatNumber(tab.count)}</span>
              )}
            </Link>
          ))}
        </div>
        {compact && (
          <Button variant="primary" size="sm" className={styles.miniAction} onClick={actions.evaluate}>
            {t("idea.action.evaluate")}
          </Button>
        )}
      </div>
    </nav>
  );
}
