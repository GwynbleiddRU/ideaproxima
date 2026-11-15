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
import { ActivityItem, ActivityList } from "@/components/ActivityItem";
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
import { useIdea, usePermissions } from "./use-idea";
import styles from "./HistoryTab.module.scss";
import tabs from "./tabs.module.scss";

/** Nothing is rewritten: every revision, decision and stage change is preserved and can be inspected. */
export function HistoryTab() {
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
            eyebrow="Awaiting a steward's decision"
            title={`Proposed revisions (${proposed.length})`}
          />
          <ul className={tabs.list} role="list">
            {proposed.map((r) => (
              <RevisionRow key={r.id} revision={r} idea={idea} onView={() => setViewing(r)} />
            ))}
          </ul>
        </section>
      )}

      <section className={tabs.group}>
        <SectionHeading eyebrow="What has been done" title="Stage history" />
        {stages.isPending ? (
          <Skeleton lines={3} />
        ) : (
          <ol className={styles.timeline} role="list">
            {[...(stages.data ?? [])].reverse().map((t) => (
              <li key={t.id}>
                <span className={styles.marker} aria-hidden />
                <div>
                  <p className={styles.transition}>
                    {t.from ? `${IDEA_STAGE_INFO[t.from].label} → ` : ""}
                    <strong>{IDEA_STAGE_INFO[t.to].label}</strong>
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
        <SectionHeading eyebrow="How the text evolved" title={`Revisions (${all.length})`} />
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
  const can = usePermissions(idea);
  const withdraw = useWithdrawRevision(idea.slug);
  const [deciding, setDeciding] = useState(false);
  const current = revision.id === idea.revision.id;
  const pending = revision.status === "proposed";
  return (
    <li className={styles.revision}>
      <div className={styles.revisionHead}>
        <span className={styles.revisionNumber}>#{revision.number}</span>
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
          {current ? "Current" : REVISION_STATUS_INFO[revision.status].label}
        </Badge>
        <p className={styles.changeNote}>{revision.changeNote || "Initial version"}</p>
      </div>
      <MetaLine>
        <span>
          <PersonLink person={revision.author} />
        </span>
        <TimeAgo iso={revision.createdAt} />
        {revision.decidedBy && (
          <span>
            {revision.status} by <PersonLink person={revision.decidedBy} />
            {revision.decisionNote ? ` — “${revision.decisionNote}”` : ""}
          </span>
        )}
      </MetaLine>
      <div className={styles.revisionActions}>
        <Button variant="quiet" size="sm" onClick={onView}>
          View changes
        </Button>
        {pending && can.canSteward && (
          <Button variant="quiet" size="sm" onClick={() => setDeciding(true)}>
            Decide
          </Button>
        )}
        {pending && can.isMe(revision.author.id) && (
          <Button
            variant="quiet"
            size="sm"
            loading={withdraw.isPending}
            onClick={() => withdraw.mutate(revision.id)}
          >
            Withdraw proposal
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
      title={`Revision #${revision.number}`}
      description={revision.changeNote}
    >
      <form onSubmit={submit("accept")} className={forms.form}>
        <p className={forms.note}>
          Accepting publishes it as the current text, crediting its author. Either way, the proposal and your
          note stay in the history.
        </p>
        <Field label="Note to the author" optional>
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
          <Button variant="danger" onClick={() => submit("reject")()} disabled={decide.isPending}>
            Decline
          </Button>
          <Button type="submit" variant="primary" loading={decide.isPending}>
            Accept and publish
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
  return (
    <Dialog
      open={!!revision}
      onClose={onClose}
      size="lg"
      title={revision ? `Revision #${revision.number}` : ""}
      description={revision?.changeNote}
    >
      {revision && <RevisionDiff revision={revision} idea={idea} />}
    </Dialog>
  );
}

function RevisionDiff({ revision, idea }: { revision: RevisionSummaryDto; idea: IdeaDetail }) {
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
    { label: "Title", before: a?.title ?? "", after: b.title },
    { label: "Summary", before: a?.summary ?? "", after: b.summary },
    ...IDEA_SECTIONS.map((key) => ({
      label: IDEA_SECTION_INFO[key].label,
      before: a?.sections[key] ?? "",
      after: b.sections[key] ?? "",
    })),
    { label: "Topics", before: listOf(a, "topics"), after: listOf(b, "topics") },
    { label: "Tags", before: listOf(a, "tags"), after: listOf(b, "tags") },
  ];
  const changed = fields
    .map((f) => ({ ...f, lines: diffLines(f.before, f.after) }))
    .filter((f) => hasChanges(f.lines));
  return (
    <div className={styles.diff}>
      <p className={tabs.muted}>
        {a ? `Compared with revision ${before.data?.number}.` : "The first version: everything is new."} Added
        lines are marked +, removed lines −.
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
        <EmptyState compact title="No textual changes" />
      )}
    </div>
  );
}

const listOf = (content: IdeaContentDto | undefined, key: "topics" | "tags") =>
  (content?.[key] ?? []).join("\n");

function Timeline({ idea }: { idea: IdeaDetail }) {
  const timeline = useInfiniteQuery(ideaQueries.timeline(idea.slug));
  const entries = timeline.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className={tabs.group}>
      <SectionHeading eyebrow="Every recorded action" title="Timeline" />
      {timeline.isPending ? (
        <Skeleton lines={6} />
      ) : (
        <ActivityList>
          {entries.map((e) => (
            <ActivityItem key={e.id} entry={e} showIdea={false} />
          ))}
        </ActivityList>
      )}
      {timeline.hasNextPage && (
        <Button onClick={() => void timeline.fetchNextPage()} loading={timeline.isFetchingNextPage}>
          Older entries
        </Button>
      )}
    </section>
  );
}
