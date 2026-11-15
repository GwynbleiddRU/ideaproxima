import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flag, HandHelping, PenLine, Scale, Star } from "lucide-react";
import type { IdeaDetail } from "@ideaproxima/contracts";
import { STANCE_KIND_INFO, STANCE_KINDS, type StanceKind } from "@ideaproxima/domain";
import { useStance } from "@/api/signals";
import { useAuthGate } from "@/components/auth";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import { MetaLine, PersonLink, TimeAgo, TopicLinks } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { StageBadge } from "@/components/Stage";
import { cx } from "@/lib/cx";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { Chip, ChipLink } from "@/ui/Chip";
import { InvolveDialog } from "./InvolveDialog";
import { StageDialog } from "./StageDialog";
import { ideaInvalidations, useIdea, usePermissions } from "./use-idea";
import styles from "./IdeaLayout.module.scss";

export function IdeaLayout() {
  const idea = useIdea();
  const param = useParams({ from: "/ideas/$idea", select: (p) => p.idea });
  const navigate = useNavigate();

  // One canonical URL per idea: an id in the address becomes the slug.
  useEffect(() => {
    if (param !== idea.slug) void navigate({ to: ".", params: { idea: idea.slug }, replace: true });
  }, [param, idea.slug, navigate]);

  return (
    <article>
      <title>{`${idea.title} · ideaproxima`}</title>
      <meta name="description" content={idea.summary} />
      <header className={cx("container", styles.header)}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to="/explore">Explore</Link>
          <span aria-hidden>/</span>
          <TopicLinks topics={idea.topics} />
        </nav>
        {idea.hidden && (
          <p className={styles.hiddenBanner} role="status">
            Hidden by moderation. Only moderators can see this idea; it remains in the record.
          </p>
        )}
        <div className={styles.titleRow}>
          <StageBadge stage={idea.stage} />
          {idea.pendingRevisionProposals > 0 && (
            <Badge tone="warning">
              {idea.pendingRevisionProposals} proposed revision
              {idea.pendingRevisionProposals === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <h1 className={styles.title}>{idea.title}</h1>
        <p className={styles.summary}>{idea.summary}</p>
        <MetaLine>
          <span>
            Proposed by <PersonLink person={idea.proposedBy} />
          </span>
          <span>
            Revision {idea.revision.number}
            {idea.revision.author.id !== idea.proposedBy.id && (
              <>
                {" "}
                by <PersonLink person={idea.revision.author} />
              </>
            )}
          </span>
          <span>
            Updated <TimeAgo iso={idea.updatedAt} />
          </span>
          <span>{idea.signals.counts.contributors} contributors</span>
        </MetaLine>
        {idea.tags.length > 0 && (
          <div className={styles.tags}>
            {idea.tags.map((tag) => (
              <ChipLink key={tag} to="/explore" search={{ tag }} className={styles.tag}>
                #{tag}
              </ChipLink>
            ))}
          </div>
        )}
        <ActionBar idea={idea} />
      </header>
      <IdeaTabs idea={idea} />
      <div className={cx("container", styles.content)}>
        <Outlet />
      </div>
    </article>
  );
}

function StanceButtons({ idea }: { idea: IdeaDetail }) {
  const stance = useStance(idea);
  const gate = useAuthGate();
  const mine = new Set(idea.viewer?.stances ?? []);
  const toggle = (kind: StanceKind) => gate(() => stance.mutate({ kind, on: !mine.has(kind) }));
  return (
    <div
      className={styles.stances}
      role="group"
      aria-label="Your perspective (community signals, not quality)"
    >
      {STANCE_KINDS.map((kind) => (
        <Chip
          key={kind}
          pressed={mine.has(kind)}
          count={idea.signals.perspectives[kind]?.count ?? 0}
          onClick={() => toggle(kind)}
          title={STANCE_KIND_INFO[kind].description}
          className={kind === "important" ? styles.important : undefined}
        >
          {kind === "important" && <Star aria-hidden />}
          {STANCE_KIND_INFO[kind].label}
        </Chip>
      ))}
    </div>
  );
}

function ActionBar({ idea }: { idea: IdeaDetail }) {
  const can = usePermissions(idea);
  const gate = useAuthGate();
  const [dialog, setDialog] = useState<"evaluate" | "involve" | "stage" | null>(null);
  const close = () => setDialog(null);
  const ratedByMe = (idea.viewer?.ratings.length ?? 0) > 0;

  return (
    <div className={styles.actionBar}>
      <StanceButtons idea={idea} />
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="sm"
          icon={<Scale />}
          onClick={() => gate(() => setDialog("evaluate"))}
        >
          {ratedByMe ? "Update evaluation" : "Evaluate"}
        </Button>
        <Button size="sm" icon={<HandHelping />} onClick={() => gate(() => setDialog("involve"))}>
          I can help
        </Button>
        <ButtonLink to="/ideas/$idea/edit" params={{ idea: idea.slug }} size="sm" variant="secondary">
          <PenLine /> {can.canSteward ? "Edit" : "Suggest an edit"}
        </ButtonLink>
        {can.canSteward && (
          <Button size="sm" variant="ghost" icon={<Flag />} onClick={() => setDialog("stage")}>
            Stage
          </Button>
        )}
        <ModerateButton kind="idea" id={idea.id} hidden={idea.hidden} />
      </div>
      <EvaluateDialog
        open={dialog === "evaluate"}
        onClose={close}
        target={{ kind: "idea", id: idea.id }}
        subject={idea.title}
        invalidate={ideaInvalidations(idea)}
      />
      <InvolveDialog open={dialog === "involve"} onClose={close} idea={idea} />
      <StageDialog open={dialog === "stage"} onClose={close} idea={idea} />
    </div>
  );
}

function IdeaTabs({ idea }: { idea: IdeaDetail }) {
  const { counts } = idea.signals;
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
    <nav className={styles.tabsBar} aria-label="Idea sections">
      <div className={cx("container", styles.tabs)}>
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
    </nav>
  );
}
