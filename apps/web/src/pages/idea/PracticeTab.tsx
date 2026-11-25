import { vocabularyField } from "@/lib/vocabulary";
import { useLocale } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ExternalLink, HandHelping, Lightbulb, Rocket } from "lucide-react";
import type { IdeaDetail, InitiativeDto } from "@ideaproxima/contracts";
import {
  CAPACITY_INFO,
  INITIATIVE_KIND_INFO,
  INITIATIVE_KINDS,
  INITIATIVE_STATUS_INFO,
  INITIATIVE_STATUSES,
  INVOLVEMENT_STATUS_INFO,
  INVOLVEMENT_STATUSES,
  LIMITS,
  OUTCOME_RESULT_INFO,
  OUTCOME_RESULTS,
  type InitiativeKind,
  type InitiativeStatus,
  type OutcomeResult,
} from "@ideaproxima/domain";
import { isApiError } from "@/api/http";
import {
  practiceQueries,
  useCreateInitiative,
  useRecordOutcome,
  useUpdateInitiativeStatus,
} from "@/api/practice";
import { signalQueries } from "@/api/signals";
import { useAuthGate } from "@/components/auth";
import forms from "@/components/forms.module.scss";
import { MetaLine, PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { SectionHeading } from "@/components/PageHeader";
import { OutcomeBadge } from "@/components/status";
import { formatDate } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field, Fieldset } from "@/ui/Field";
import { EmptyState, FormError, Skeleton } from "@/ui/Feedback";
import { InvolveDialog } from "./InvolveDialog";
import { useIdea, usePermissions } from "./use-idea";
import styles from "./PracticeTab.module.scss";
import tabs from "./tabs.module.scss";

/**
 * What happened when the idea met the world: who is working on it, and every initiative with its outcomes —
 * failures included, with their lessons, because failed experiments are knowledge too.
 */
export function PracticeTab() {
  const idea = useIdea();
  return (
    <div className={tabs.tab}>
      <People idea={idea} />
      <Initiatives idea={idea} />
    </div>
  );
}

function People({ idea }: { idea: IdeaDetail }) {
  useLocale();
  const gate = useAuthGate();
  const involvements = useQuery(signalQueries.involvements(idea.slug));
  const [open, setOpen] = useState(false);
  const all = involvements.data ?? [];
  return (
    <section className={tabs.group}>
      <SectionHeading
        eyebrow="Who can carry it forward"
        title="People involved"
        action={
          <Button size="sm" icon={<HandHelping />} onClick={() => gate(() => setOpen(true))}>
            I can help
          </Button>
        }
      />
      {involvements.isPending ? (
        <Skeleton lines={3} />
      ) : all.length ? (
        <div className={styles.people}>
          {INVOLVEMENT_STATUSES.map((status) => {
            const group = all.filter((i) => i.status === status);
            if (!group.length) return null;
            return (
              <div key={status} className={styles.peopleGroup}>
                <p className="eyebrow">
                  {vocabularyField(
                    "involvementStatuses",
                    status,
                    "label",
                    INVOLVEMENT_STATUS_INFO[status].label,
                  )}
                </p>
                <ul className={styles.peopleList} role="list">
                  {group.map((i) => (
                    <li key={`${i.person.id}-${i.capacity}`}>
                      <PersonLink person={i.person} avatar size={28} />
                      <Badge tone="primary">
                        {vocabularyField("capacities", i.capacity, "label", CAPACITY_INFO[i.capacity].label)}
                      </Badge>
                      {i.note && <p className={styles.note}>{i.note}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState compact title="Nobody has stepped forward yet">
          Researchers, engineers, funders and organisers can say how they could help, so they can find each
          other.
        </EmptyState>
      )}
      <InvolveDialog open={open} onClose={() => setOpen(false)} idea={idea} />
    </section>
  );
}

function Initiatives({ idea }: { idea: IdeaDetail }) {
  const gate = useAuthGate();
  const initiatives = useQuery(practiceQueries.initiatives(idea.slug));
  const [creating, setCreating] = useState(false);
  return (
    <section className={tabs.group}>
      <SectionHeading
        eyebrow="Research, experiments, pilots, deployments"
        title="Initiatives & outcomes"
        action={
          <Button variant="primary" size="sm" icon={<Rocket />} onClick={() => gate(() => setCreating(true))}>
            Record an initiative
          </Button>
        }
      />
      {initiatives.isPending ? (
        <Skeleton lines={5} />
      ) : initiatives.data?.length ? (
        <div className={tabs.stack}>
          {initiatives.data.map((i) => (
            <InitiativeCard key={i.id} initiative={i} idea={idea} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon={<Rocket />} title="No initiatives recorded">
          When someone researches, tests or deploys this idea — successfully or not — record it here. An
          experiment with a recorded outcome is what moves an idea to “Tested”.
        </EmptyState>
      )}
      <CreateInitiativeDialog open={creating} onClose={() => setCreating(false)} idea={idea} />
    </section>
  );
}

function InitiativeCard({ initiative, idea }: { initiative: InitiativeDto; idea: IdeaDetail }) {
  useLocale();
  const can = usePermissions(idea);
  const [dialog, setDialog] = useState<"status" | "outcome" | null>(null);
  const dates = [
    initiative.startedOn && formatDate(initiative.startedOn),
    initiative.endedOn && formatDate(initiative.endedOn),
  ]
    .filter(Boolean)
    .join(" – ");
  return (
    <article className={styles.initiative}>
      <header className={styles.initiativeHead}>
        <Badge tone="outline">
          {vocabularyField(
            "initiativeKinds",
            initiative.kind,
            "label",
            INITIATIVE_KIND_INFO[initiative.kind].label,
          )}
        </Badge>
        <Badge
          tone={
            initiative.status === "active"
              ? "primary"
              : initiative.status === "discontinued"
                ? "danger"
                : "neutral"
          }
        >
          {vocabularyField(
            "initiativeStatuses",
            initiative.status,
            "label",
            INITIATIVE_STATUS_INFO[initiative.status].label,
          )}
        </Badge>
        {initiative.hidden && <Badge tone="warning">Hidden</Badge>}
      </header>
      <h3 className={styles.initiativeTitle}>{initiative.title}</h3>
      <MetaLine>
        {initiative.organization && <span>{initiative.organization}</span>}
        {dates && <span>{dates}</span>}
        {initiative.url && (
          <a href={initiative.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="link">
            Website <ExternalLink size={12} aria-hidden />
          </a>
        )}
      </MetaLine>
      <p className={styles.description}>{initiative.description}</p>
      {initiative.outcomes.length > 0 && (
        <div className={styles.outcomes}>
          {initiative.outcomes.map((o) => (
            <div key={o.id} className={styles.outcome} data-result={o.result}>
              <div className={styles.outcomeHead}>
                <OutcomeBadge result={o.result} />
                <span className={styles.note}>
                  recorded by <PersonLink person={o.recordedBy} /> · <TimeAgo iso={o.recordedAt} />
                </span>
              </div>
              <p>{o.summary}</p>
              {o.lessons && (
                <p className={styles.lessons}>
                  <Lightbulb size={16} aria-hidden />
                  <span>
                    <strong>What was learned:</strong> {o.lessons}
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <footer className={styles.initiativeFoot}>
        <MetaLine>
          <span>
            Recorded by <PersonLink person={initiative.createdBy} />
          </span>
          <TimeAgo iso={initiative.createdAt} />
        </MetaLine>
        <div className={styles.actions}>
          {can.canCurate(initiative.createdBy.id) && (
            <>
              <Button variant="quiet" size="sm" onClick={() => setDialog("status")}>
                Update status
              </Button>
              <Button variant="quiet" size="sm" onClick={() => setDialog("outcome")}>
                Record outcome
              </Button>
            </>
          )}
          <ModerateButton kind="initiative" id={initiative.id} hidden={initiative.hidden} />
        </div>
      </footer>
      <StatusDialog
        open={dialog === "status"}
        onClose={() => setDialog(null)}
        initiative={initiative}
        slug={idea.slug}
      />
      <OutcomeDialog
        open={dialog === "outcome"}
        onClose={() => setDialog(null)}
        initiative={initiative}
        slug={idea.slug}
      />
    </article>
  );
}

function CreateInitiativeDialog({
  open,
  onClose,
  idea,
}: {
  open: boolean;
  onClose: () => void;
  idea: IdeaDetail;
}) {
  useLocale();
  const create = useCreateInitiative(idea.slug);
  const [kind, setKind] = useState<InitiativeKind>("research");
  const [status, setStatus] = useState<InitiativeStatus>("planned");
  const [form, setForm] = useState({
    title: "",
    description: "",
    organization: "",
    url: "",
    startedOn: "",
    endedOn: "",
  });
  const errors = isApiError(create.error) ? create.error.fieldErrors : {};
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        kind,
        status,
        title: form.title.trim(),
        description: form.description.trim(),
        organization: form.organization.trim() || undefined,
        url: form.url.trim() || undefined,
        startedOn: form.startedOn || undefined,
        endedOn: form.endedOn || undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Record an initiative"
      description="Real-world action on this idea. Past initiatives can be recorded as completed."
    >
      <form onSubmit={submit} className={forms.form}>
        <Fieldset legend="Kind">
          <div className={forms.choices}>
            {INITIATIVE_KINDS.map((k) => (
              <label key={k} className={forms.choice}>
                <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                <strong>
                  {vocabularyField("initiativeKinds", k, "label", INITIATIVE_KIND_INFO[k].label)}
                </strong>
                <span>
                  {vocabularyField("initiativeKinds", k, "description", INITIATIVE_KIND_INFO[k].description)}
                </span>
              </label>
            ))}
          </div>
        </Fieldset>
        <Field label="Title" error={errors.title}>
          {(p) => (
            <input
              {...p}
              className={control}
              value={form.title}
              onChange={set("title")}
              minLength={5}
              maxLength={200}
              required
            />
          )}
        </Field>
        <Field label="What is being done, and how" error={errors.description}>
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={form.description}
              onChange={set("description")}
              minLength={20}
              maxLength={10000}
              required
              rows={4}
            />
          )}
        </Field>
        <div className={forms.row}>
          <Field label="Organisation" optional>
            {(p) => (
              <input
                {...p}
                className={control}
                value={form.organization}
                onChange={set("organization")}
                maxLength={200}
              />
            )}
          </Field>
          <Field label="Website" optional error={errors.url}>
            {(p) => (
              <input
                {...p}
                className={control}
                type="url"
                value={form.url}
                onChange={set("url")}
                placeholder="https://"
              />
            )}
          </Field>
        </div>
        <div className={forms.row}>
          <Field label="Status">
            {(p) => (
              <select
                {...p}
                className={control}
                value={status}
                onChange={(e) => setStatus(e.target.value as InitiativeStatus)}
              >
                {INITIATIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {vocabularyField("initiativeStatuses", s, "label", INITIATIVE_STATUS_INFO[s].label)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Started" optional>
            {(p) => (
              <input
                {...p}
                className={control}
                type="date"
                value={form.startedOn}
                onChange={set("startedOn")}
              />
            )}
          </Field>
          <Field label="Ended" optional>
            {(p) => (
              <input {...p} className={control} type="date" value={form.endedOn} onChange={set("endedOn")} />
            )}
          </Field>
        </div>
        <FormError error={create.error} />
        <div className={forms.actions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Record initiative
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function StatusDialog({
  open,
  onClose,
  initiative,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  initiative: InitiativeDto;
  slug: string;
}) {
  useLocale();
  const update = useUpdateInitiativeStatus(slug);
  const [status, setStatus] = useState<InitiativeStatus>(initiative.status);
  const [note, setNote] = useState("");
  const [on, setOn] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      { initiativeId: initiative.id, status, note: note.trim() || undefined, on: on || undefined },
      { onSuccess: onClose },
    );
  };
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="Update status" description={initiative.title}>
      <form onSubmit={submit} className={forms.form}>
        <Fieldset legend="Status">
          <div className={forms.choices}>
            {INITIATIVE_STATUSES.map((s) => (
              <label key={s} className={forms.choice}>
                <input type="radio" name="status" checked={status === s} onChange={() => setStatus(s)} />
                <strong>
                  {vocabularyField("initiativeStatuses", s, "label", INITIATIVE_STATUS_INFO[s].label)}
                </strong>
                <span>
                  {vocabularyField(
                    "initiativeStatuses",
                    s,
                    "description",
                    INITIATIVE_STATUS_INFO[s].description,
                  )}
                </span>
              </label>
            ))}
          </div>
        </Fieldset>
        <Field label="Effective date" optional>
          {(p) => (
            <input
              {...p}
              className={control}
              type="date"
              value={on}
              onChange={(e) => setOn(e.target.value)}
            />
          )}
        </Field>
        <Field label="Note" optional>
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={LIMITS.rationale.max}
              rows={2}
            />
          )}
        </Field>
        <FormError error={update.error} />
        <div className={forms.actions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function OutcomeDialog({
  open,
  onClose,
  initiative,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  initiative: InitiativeDto;
  slug: string;
}) {
  useLocale();
  const record = useRecordOutcome(slug);
  const [result, setResult] = useState<OutcomeResult>("succeeded");
  const [summary, setSummary] = useState("");
  const [lessons, setLessons] = useState("");
  const errors = isApiError(record.error) ? record.error.fieldErrors : {};
  const submit = (event: FormEvent) => {
    event.preventDefault();
    record.mutate(
      { initiativeId: initiative.id, result, summary: summary.trim(), lessons: lessons.trim() || undefined },
      { onSuccess: onClose },
    );
  };
  return (
    <Dialog open={open} onClose={onClose} title="Record an outcome" description={initiative.title}>
      <form onSubmit={submit} className={forms.form}>
        <Fieldset legend="Result">
          <div className={forms.choices}>
            {OUTCOME_RESULTS.map((r) => (
              <label key={r} className={forms.choice}>
                <input type="radio" name="result" checked={result === r} onChange={() => setResult(r)} />
                <strong>{vocabularyField("outcomeResults", r, "label", OUTCOME_RESULT_INFO[r].label)}</strong>
                <span>
                  {vocabularyField("outcomeResults", r, "description", OUTCOME_RESULT_INFO[r].description)}
                </span>
              </label>
            ))}
          </div>
        </Fieldset>
        <Field label="What happened" error={errors.summary}>
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              minLength={20}
              maxLength={10000}
              required
              rows={4}
            />
          )}
        </Field>
        <Field
          label="What was learned"
          optional
          hint="Required later to move the idea to “Learned from”. The most valuable part of a failure."
        >
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              maxLength={10000}
              rows={3}
            />
          )}
        </Field>
        <FormError error={record.error} />
        <div className={forms.actions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={record.isPending}>
            Record outcome
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
