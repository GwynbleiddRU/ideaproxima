import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { IdeaContentDto, IdeaDetail, RevisionSummaryDto } from "@ideaproxima/contracts";
import {
  IDEA_SECTION_INFO,
  IDEA_SECTIONS,
  IDEA_STAGE_INFO,
  LIMITS,
  REVISION_STATUS_INFO,
} from "@ideaproxima/domain";
import { ideaQueries, useDecideRevision, useWithdrawRevision } from "@/api/ideas";
import { ActivityFeed } from "@/components/ActivityFeed";
import forms from "@/components/forms.module.scss";
import { MetaLine, PersonLink, TimeAgo } from "@/components/meta";
import { SectionHeading } from "@/components/PageHeader";
import { cx } from "@/lib/cx";
import { diffLines, hasChanges } from "@/lib/diff";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field } from "@/ui/Field";
import { EmptyState, FormError, LoadingBlock, Skeleton } from "@/ui/Feedback";
import { Segmented } from "@/ui/Segmented";
import { useIdea, usePermissions } from "./use-idea";
import styles from "./HistoryTab.module.scss";
import tabs from "./tabs.module.scss";

/** Nothing is rewritten: every revision, decision and stage change is preserved and can be inspected. */
export function HistoryTab() {
  const t = useMessage();
  const idea = useIdea();
  const revisions = useQuery(ideaQueries.revisions(idea.slug));
  const stages = useQuery(ideaQueries.stages(idea.slug));
  const [viewing, setViewing] = useState<RevisionSummaryDto | null>(null);
  const all = revisions.data ?? [];
  const proposed = all.filter((r) => r.status === "proposed");

  return (
    <div className={tabs.tab}>
      {proposed.length > 0 && (
        <section className={tabs.group}>
          <SectionHeading
            eyebrow={t("idea.history.proposedEyebrow")}
            title={t("idea.history.proposedCount", { count: proposed.length })}
          />
          <ul className={tabs.list} role="list">
            {proposed.map((r) => (
              <RevisionRow key={r.id} revision={r} idea={idea} onView={() => setViewing(r)} />
            ))}
          </ul>
        </section>
      )}

      <section className={tabs.group}>
        <SectionHeading eyebrow={t("idea.history.stageEyebrow")} title={t("idea.history.stages")} />
        {stages.isPending ? (
          <Skeleton lines={3} />
        ) : (
          <ol className={styles.timeline} role="list">
            {[...(stages.data ?? [])].reverse().map((t) => (
              <li key={t.id}>
                <span className={styles.marker} aria-hidden />
                <div>
                  <p className={styles.transition}>
                    <LocalizedText
                      id={t.from ? "idea.history.transition" : "idea.history.firstStage"}
                      values={{
                        from: t.from
                          ? vocabularyField("stages", t.from, "label", IDEA_STAGE_INFO[t.from].label)
                          : "",
                        to: vocabularyField("stages", t.to, "label", IDEA_STAGE_INFO[t.to].label),
                      }}
                      components={{ 0: <strong /> }}
                    />
                  </p>
                  {t.rationale && <p className={tabs.muted}>{t.rationale}</p>}
                  <MetaLine>
                    <span>
                      <PersonLink person={t.decidedBy} />
                    </span>
                    <TimeAgo iso={t.occurredAt} />
                  </MetaLine>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={tabs.group}>
        <SectionHeading
          eyebrow={t("idea.history.revisionsEyebrow")}
          title={t("idea.history.revisionCount", { count: all.length })}
        />
        {revisions.isPending ? (
          <Skeleton lines={4} />
        ) : (
          <ul className={tabs.list} role="list">
            {all
              .filter((r) => r.status !== "proposed")
              .map((r) => (
                <RevisionRow key={r.id} revision={r} idea={idea} onView={() => setViewing(r)} />
              ))}
          </ul>
        )}
      </section>

      <Timeline idea={idea} />
      <RevisionDialog revision={viewing} idea={idea} onClose={() => setViewing(null)} />
    </div>
  );
}

function RevisionRow({
  revision,
  idea,
  onView,
}: {
  revision: RevisionSummaryDto;
  idea: IdeaDetail;
  onView: () => void;
}) {
  const t = useMessage();
  const can = usePermissions(idea);
  const withdraw = useWithdrawRevision(idea.slug);
  const [deciding, setDeciding] = useState(false);
  const current = revision.id === idea.revision.id;
  const pending = revision.status === "proposed";
  const status = vocabularyField(
    "revisionStatuses",
    revision.status,
    "label",
    REVISION_STATUS_INFO[revision.status].label,
  );
  return (
    <li className={styles.revision}>
      <div className={styles.revisionHead}>
        <span className={styles.revisionNumber}>
          {t("idea.history.revisionNumber", { number: revision.number })}
        </span>
        <Badge
          tone={
            pending
              ? "warning"
              : revision.status === "accepted"
                ? "success"
                : revision.status === "rejected"
                  ? "danger"
                  : "neutral"
          }
        >
          {current ? t("idea.history.current") : status}
        </Badge>
        <p className={styles.changeNote}>{revision.changeNote || t("idea.history.initial")}</p>
      </div>
      <MetaLine>
        <span>
          <PersonLink person={revision.author} />
        </span>
        <TimeAgo iso={revision.createdAt} />
        {revision.decidedBy && (
          <span>
            <LocalizedText
              id={revision.decisionNote ? "idea.history.decidedWithNote" : "idea.history.decidedBy"}
              values={{ status }}
              components={{
                0: <PersonLink person={revision.decidedBy} />,
                1: <bdi>{revision.decisionNote}</bdi>,
              }}
            />
          </span>
        )}
      </MetaLine>
      <div className={styles.revisionActions}>
        <Button variant="quiet" size="sm" onClick={onView}>
          {t("idea.history.view")}
        </Button>
        {pending && can.canSteward && (
          <Button variant="quiet" size="sm" onClick={() => setDeciding(true)}>
            {t("idea.history.decide")}
          </Button>
        )}
        {pending && can.isMe(revision.author.id) && (
          <Button
            variant="quiet"
            size="sm"
            retryError={withdraw.error}
            loading={withdraw.isPending}
            onClick={() => withdraw.mutate(revision.id)}
          >
            {t("idea.history.withdraw")}
          </Button>
        )}
      </div>
      <DecisionDialog
        open={deciding}
        onClose={() => setDeciding(false)}
        revision={revision}
        slug={idea.slug}
      />
    </li>
  );
}

function DecisionDialog({
  open,
  onClose,
  revision,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  revision: RevisionSummaryDto;
  slug: string;
}) {
  const t = useMessage();
  const decide = useDecideRevision(slug);
  const [note, setNote] = useState("");
  const submit = (decision: "accept" | "reject") => (event?: FormEvent) => {
    event?.preventDefault();
    decide.mutate(
      { revisionId: revision.id, decision, note: note.trim() || undefined },
      { onSuccess: onClose },
    );
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={t("idea.history.revisionTitle", { number: revision.number })}
      description={revision.changeNote}
    >
      <form onSubmit={submit("accept")} className={forms.form}>
        <p className={forms.note}>{t("idea.history.decisionHelp")}</p>
        <Field label={t("idea.history.note")} optional>
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={LIMITS.rationale.max}
              rows={3}
            />
          )}
        </Field>
        <FormError error={decide.error} />
        <div className={forms.actions}>
          <Button
            variant="danger"
            onClick={() => submit("reject")()}
            retryError={decide.error}
            disabled={decide.isPending}
          >
            {t("idea.history.decline")}
          </Button>
          <Button type="submit" variant="primary" retryError={decide.error} loading={decide.isPending}>
            {t("idea.history.accept")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RevisionDialog({
  revision,
  idea,
  onClose,
}: {
  revision: RevisionSummaryDto | null;
  idea: IdeaDetail;
  onClose: () => void;
}) {
  const t = useMessage();
  return (
    <Dialog
      open={!!revision}
      onClose={onClose}
      size="lg"
      title={revision ? t("idea.history.revisionTitle", { number: revision.number }) : ""}
      description={revision?.changeNote}
    >
      {revision && <RevisionDiff revision={revision} idea={idea} />}
    </Dialog>
  );
}

function RevisionDiff({ revision, idea }: { revision: RevisionSummaryDto; idea: IdeaDetail }) {
  const t = useMessage();
  const after = useQuery(ideaQueries.revision(idea.slug, revision.id));
  const before = useQuery({
    ...ideaQueries.revision(idea.slug, revision.baseRevisionId ?? ""),
    enabled: !!revision.baseRevisionId,
  });
  if (after.isPending || (revision.baseRevisionId && before.isPending)) return <LoadingBlock />;
  if (!after.data) return null;
  const a = before.data?.content;
  const b = after.data.content;
  const fields: { label: string; before: string; after: string }[] = [
    { label: t("common.title"), before: a?.title ?? "", after: b.title },
    { label: t("idea.history.summary"), before: a?.summary ?? "", after: b.summary },
    ...IDEA_SECTIONS.map((key) => ({
      label: vocabularyField("sections", key, "label", IDEA_SECTION_INFO[key].label),
      before: a?.sections[key] ?? "",
      after: b.sections[key] ?? "",
    })),
    { label: t("nav.topics"), before: listOf(a, "topics"), after: listOf(b, "topics") },
    { label: t("idea.history.tags"), before: listOf(a, "tags"), after: listOf(b, "tags") },
  ];
  const changed = fields
    .map((f) => ({ ...f, lines: diffLines(f.before, f.after) }))
    .filter((f) => hasChanges(f.lines));
  return (
    <div className={styles.diff}>
      <p className={tabs.muted}>
        {before.data
          ? t("idea.history.compared", { number: before.data.number })
          : t("idea.history.firstDiff")}
      </p>
      {changed.length ? (
        changed.map((f) => (
          <section key={f.label}>
            <h3 className="eyebrow">{f.label}</h3>
            <pre className={styles.lines}>
              {f.lines.map((l, i) => (
                <span key={i} className={cx(styles.line, styles[l.kind])}>
                  <span aria-hidden>{l.kind === "added" ? "+" : l.kind === "removed" ? "−" : " "}</span>
                  {l.text || " "}
                  {"\n"}
                </span>
              ))}
            </pre>
          </section>
        ))
      ) : (
        <EmptyState compact title={t("idea.history.noChanges")} />
      )}
    </div>
  );
}

const listOf = (content: IdeaContentDto | undefined, key: "topics" | "tags") =>
  (content?.[key] ?? []).join("\n");

/** Kinds of recorded action the timeline can be narrowed to (by action prefix). */
const TIMELINE_FILTERS = {
  all: { label: "idea.history.everything", prefixes: [] },
  text: { label: "idea.history.textAndStage", prefixes: ["idea.", "revision.", "stage.", "steward."] },
  knowledge: {
    label: "idea.history.knowledgeAndDebate",
    prefixes: ["claim.", "evidence.", "source.", "relation.", "argument.", "comment."],
  },
  judgement: { label: "idea.history.evaluationsAndPerspectives", prefixes: ["evaluation.", "stance."] },
  practice: { label: "idea.history.practice", prefixes: ["involvement.", "initiative.", "outcome."] },
} as const;
type TimelineFilter = keyof typeof TIMELINE_FILTERS;

function Timeline({ idea }: { idea: IdeaDetail }) {
  const t = useMessage();
  const timeline = useInfiniteQuery(ideaQueries.timeline(idea.slug));
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const prefixes: readonly string[] = TIMELINE_FILTERS[filter].prefixes;
  const entries = (timeline.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (e) => !prefixes.length || prefixes.some((p) => e.action.startsWith(p)),
  );
  return (
    <section className={tabs.group}>
      <SectionHeading eyebrow={t("idea.history.activityEyebrow")} title={t("idea.history.timeline")} />
      <Segmented<TimelineFilter>
        label={t("idea.history.show")}
        size="sm"
        value={filter}
        onChange={setFilter}
        options={Object.entries(TIMELINE_FILTERS).map(([value, f]) => ({
          value: value as TimelineFilter,
          label: t(f.label),
        }))}
      />
      {timeline.isPending ? (
        <Skeleton lines={6} />
      ) : entries.length ? (
        <ActivityFeed entries={entries} showIdea={false} byDay />
      ) : (
        <p className={tabs.muted}>{t("idea.history.noActivity")}</p>
      )}
      {timeline.hasNextPage && (
        <Button onClick={() => void timeline.fetchNextPage()} loading={timeline.isFetchingNextPage}>
          {t("idea.history.older")}
        </Button>
      )}
    </section>
  );
}
