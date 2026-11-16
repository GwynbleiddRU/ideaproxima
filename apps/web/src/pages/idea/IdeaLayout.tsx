import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ChevronRight, Flag, Gauge, HandHelping, PenLine, Star } from "lucide-react";
import type { IdeaDetail, RatingSummaryDto } from "@ideaproxima/contracts";
import { IDEA_STAGE_INFO, IDEA_STAGES, stageOrdinal, type DimensionKey } from "@ideaproxima/domain";
import { useStance } from "@/api/signals";
import { useAuthGate } from "@/components/auth";
import { PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { isConfident, nearestAnchor } from "@/components/Ratings";
import { StageBadge } from "@/components/Stage";
import { cx } from "@/lib/cx";
import { plural } from "@/lib/format";
import { useScrolledPast } from "@/lib/hooks";
import { MIN_RATINGS_FOR_CONFIDENCE } from "@/lib/vocabulary";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { Dots } from "@/ui/Meter";
import { IdeaActionsProvider, useIdeaActions } from "./actions";
import { useIdea, usePermissions } from "./use-idea";
import styles from "./IdeaLayout.module.scss";

export function IdeaLayout() {
  const idea = useIdea();
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
        <title>{`${idea.title} · ideaproxima`}</title>
        <meta name="description" content={idea.summary} />
        <header className={cx("container", styles.header)}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link to="/explore">Explore</Link>
            {idea.topics.map((topic) => (
              <span key={topic.id} className={styles.crumb}>
                <ChevronRight aria-hidden />
                <Link to="/topics/$slug" params={{ slug: topic.slug }}>
                  {topic.name}
                </Link>
              </span>
            ))}
          </nav>
          {idea.hidden && (
            <p className={styles.hiddenBanner} role="status">
              Hidden by moderation. Only moderators can see this idea; it remains in the record.
            </p>
          )}
          <div className={styles.badges}>
            <StageBadge stage={idea.stage} />
            {idea.pendingRevisionProposals > 0 && (
              <Badge tone="warning">{plural(idea.pendingRevisionProposals, "proposed revision")}</Badge>
            )}
          </div>
          <h1 ref={title} className={styles.title}>
            {idea.title}
          </h1>
          <p className={styles.summary}>{idea.summary}</p>
          <div className={styles.meta}>
            <span>
              <Avatar name={idea.proposedBy.displayName} seed={idea.proposedBy.handle} size={22} />
              Proposed by <PersonLink person={idea.proposedBy} />
            </span>
            <span>
              Revision {idea.revision.number}
              {idea.revision.author.id !== idea.proposedBy.id && (
                <>
                  {" "}
                  by <PersonLink person={idea.revision.author} />
                </>
              )}{" "}
              · updated <TimeAgo iso={idea.updatedAt} />
            </span>
            <span className={styles.wide}>{plural(idea.signals.counts.contributors, "contributor")}</span>
            {idea.tags.length > 0 && (
              <span className={cx(styles.tags, styles.wide)}>
                {idea.tags.map((tag) => (
                  <Link key={tag} to="/explore" search={{ tag }} className={styles.tag}>
                    #{tag}
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
  const { ratings, counts } = idea.signals;
  const measure = (d: DimensionKey, label: string, summary: RatingSummaryDto | undefined) => (
    <div>
      <span>{label}</span>
      {summary && isConfident(summary) ? (
        <>
          <b>{nearestAnchor(d, summary.mean)}</b>
          <span>
            {summary.mean.toFixed(1)} · n={summary.n}
          </span>
        </>
      ) : (
        <>
          <b className={styles.early}>Too early</b>
          <span className={styles.dots}>
            <Dots n={summary?.n ?? 0} of={MIN_RATINGS_FOR_CONFIDENCE} /> {summary?.n ?? 0} of{" "}
            {MIN_RATINGS_FOR_CONFIDENCE}
          </span>
        </>
      )}
    </div>
  );
  const ordinal = stageOrdinal(idea.stage);
  return (
    <div className={styles.glance} aria-label="At a glance" role="group">
      {measure("impact", "Potential impact", ratings.impact)}
      {measure("feasibility", "Feasibility", ratings.feasibility)}
      <div>
        <span>What is known</span>
        <b>{plural(counts.claims, "claim")}</b>
        <span>{counts.evidence ? plural(counts.evidence, "source") : "no evidence yet"}</span>
      </div>
      <div>
        <span>Stage</span>
        <b>{IDEA_STAGE_INFO[idea.stage].label}</b>
        <span>
          {ordinal + 1} of {IDEA_STAGES.length}
        </span>
      </div>
    </div>
  );
}

/** "Important": the attention signal. Set apart from the quality actions, never among them. */
function ImportantToggle({ idea }: { idea: IdeaDetail }) {
  const stance = useStance(idea);
  const gate = useAuthGate();
  const on = !!idea.viewer?.stances.includes("important");
  const count = idea.signals.perspectives.important?.count ?? idea.signals.attention;
  return (
    <Button
      size="sm"
      className={cx(styles.important, on && styles.importantOn)}
      aria-pressed={on}
      title="Mark it important. Counted as attention — never as quality."
      onClick={() => gate(() => stance.mutate({ kind: "important", on: !on }))}
    >
      <Star aria-hidden />
      <span className={styles.wideLabel}>Important</span>
      <span className={styles.count}>{count}</span>
    </Button>
  );
}

function ActionBar({ idea }: { idea: IdeaDetail }) {
  const can = usePermissions(idea);
  const actions = useIdeaActions();
  const ratedByMe = (idea.viewer?.ratings.length ?? 0) > 0;
  const editLabel = can.canSteward ? "Edit" : "Suggest an edit";
  return (
    <div className={styles.actions}>
      <Button variant="primary" size="sm" icon={<Gauge />} onClick={actions.evaluate}>
        {ratedByMe ? "Update evaluation" : "Evaluate"}
      </Button>
      <Button size="sm" icon={<HandHelping />} onClick={actions.involve}>
        I can help
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
          Stage
        </Button>
      )}
      <ModerateButton kind="idea" id={idea.id} hidden={idea.hidden} />
      <span className={styles.grow} />
      <ImportantToggle idea={idea} />
    </div>
  );
}

function IdeaTabs({ idea, compact }: { idea: IdeaDetail; compact: boolean }) {
  const { counts } = idea.signals;
  const actions = useIdeaActions();
  const params = { idea: idea.slug };
  const tabs = [
    { to: "/ideas/$idea", label: "Overview", exact: true },
    { to: "/ideas/$idea/evidence", label: "Claims & evidence", count: counts.claims },
    { to: "/ideas/$idea/discussion", label: "Discussion", count: counts.arguments + counts.comments },
    { to: "/ideas/$idea/connections", label: "Connections" },
    { to: "/ideas/$idea/practice", label: "In practice", count: counts.initiatives },
    { to: "/ideas/$idea/history", label: "History", count: idea.pendingRevisionProposals || undefined },
  ] as const;
  return (
    <nav className={cx(styles.tabsBar, compact && styles.compact)} aria-label="Idea sections">
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
              {tab.label}
              {"count" in tab && tab.count !== undefined && tab.count > 0 && (
                <span className={styles.tabCount}>{tab.count}</span>
              )}
            </Link>
          ))}
        </div>
        {compact && (
          <Button variant="primary" size="sm" className={styles.miniAction} onClick={actions.evaluate}>
            Evaluate
          </Button>
        )}
      </div>
    </nav>
  );
}
