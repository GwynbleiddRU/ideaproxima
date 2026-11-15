import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties, type FormEvent } from "react";
import { ThumbsUp } from "lucide-react";
import type { ArgumentDto } from "@ideaproxima/contracts";
import { ARGUMENT_STANCE_INFO, ARGUMENT_STANCES, LIMITS, type ArgumentStance } from "@ideaproxima/domain";
import { useMarkUseful } from "@/api/discussion";
import { isApiError } from "@/api/http";
import { knowledgeQueries, useCreateArgument, useWithdrawArgument } from "@/api/knowledge";
import { useSession } from "@/api/session";
import { useAuthGate } from "@/components/auth";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import forms from "@/components/forms.module.scss";
import { MetaLine, PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { RatingMeter } from "@/components/Ratings";
import { ReasonDialog } from "@/components/ReasonDialog";
import { argumentStanceColor, ArgumentStanceBadge } from "@/components/status";
import { cx } from "@/lib/cx";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { control, Field, Fieldset } from "@/ui/Field";
import { FormError, Skeleton } from "@/ui/Feedback";
import styles from "./knowledge.module.scss";

type Keys = readonly (readonly unknown[])[];

/** "Useful" — a binary evaluation. Pressed state is remembered for this visit; counts come from the API. */
export function UsefulButton({
  kind,
  id,
  count,
  invalidate,
}: {
  kind: "comment" | "argument";
  id: string;
  count: number;
  invalidate: Keys;
}) {
  const gate = useAuthGate();
  const mark = useMarkUseful(invalidate);
  const [marked, setMarked] = useState(false);
  return (
    <Button
      variant="quiet"
      size="sm"
      icon={<ThumbsUp />}
      aria-pressed={marked}
      className={cx(marked && styles.usefulOn)}
      loading={mark.isPending}
      onClick={() =>
        gate(() => mark.mutate({ kind, id, useful: !marked }, { onSuccess: () => setMarked(!marked) }))
      }
    >
      Useful{count > 0 ? ` · ${count}` : ""}
    </Button>
  );
}

/** A structured argument for, against, or qualifying an idea, a claim or another argument. */
export function ArgumentCard({
  argument,
  invalidate,
  depth = 0,
}: {
  argument: ArgumentDto;
  invalidate: Keys;
  depth?: number;
}) {
  const { me, isModerator } = useSession();
  const gate = useAuthGate();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"assess" | "withdraw" | "reply" | null>(null);
  const withdraw = useWithdrawArgument([...invalidate, ["argument", argument.id]]);
  const withdrawn = !!argument.withdrawnAt;
  const style = { "--stance": argumentStanceColor(argument.stance) } as CSSProperties;

  return (
    <article className={cx(styles.argument, withdrawn && styles.withdrawn)} style={style}>
      <header className={styles.argumentHead}>
        <ArgumentStanceBadge stance={argument.stance} />
        {withdrawn && <Badge tone="danger">Withdrawn</Badge>}
        {argument.hidden && <Badge tone="warning">Hidden</Badge>}
      </header>
      <h3 className={styles.argumentTitle}>{argument.title}</h3>
      <p className={styles.argumentBody}>{argument.body}</p>
      {argument.derived.strength && (
        <div className={styles.argumentMeter}>
          <RatingMeter dimension="strength" summary={argument.derived.strength} size="sm" />
        </div>
      )}
      <footer className={styles.footer}>
        <MetaLine>
          <span>
            <PersonLink person={argument.author} />
          </span>
          <TimeAgo iso={argument.createdAt} />
        </MetaLine>
        <div className={styles.footerActions}>
          <UsefulButton
            kind="argument"
            id={argument.id}
            count={argument.derived.usefulCount}
            invalidate={invalidate}
          />
          {!withdrawn && (
            <Button variant="quiet" size="sm" onClick={() => gate(() => setDialog("assess"))}>
              Assess
            </Button>
          )}
          {depth < 3 && !withdrawn && (
            <Button variant="quiet" size="sm" onClick={() => gate(() => setDialog("reply"))}>
              Respond
            </Button>
          )}
          {argument.replyCount > 0 && (
            <Button variant="quiet" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? "Hide" : "Show"} {argument.replyCount} response{argument.replyCount === 1 ? "" : "s"}
            </Button>
          )}
          {!withdrawn && (isModerator || me?.id === argument.author.id) && (
            <Button variant="quiet" size="sm" onClick={() => setDialog("withdraw")}>
              Withdraw
            </Button>
          )}
          <ModerateButton kind="argument" id={argument.id} hidden={argument.hidden} />
        </div>
      </footer>
      {dialog === "reply" && (
        <div className={styles.replyForm}>
          <ArgumentComposer
            target={{ kind: "argument", id: argument.id }}
            invalidate={[...invalidate, ["argument", argument.id]]}
            onDone={() => {
              setDialog(null);
              setOpen(true);
            }}
            compact
          />
        </div>
      )}
      {open && <Replies id={argument.id} invalidate={invalidate} depth={depth + 1} />}
      <EvaluateDialog
        open={dialog === "assess"}
        onClose={() => setDialog(null)}
        target={{ kind: "argument", id: argument.id }}
        subject={argument.title}
        invalidate={invalidate}
      />
      <ReasonDialog
        open={dialog === "withdraw"}
        onClose={() => setDialog(null)}
        title="Withdraw this argument"
        description="It stays in the discussion, marked as withdrawn."
        confirmLabel="Withdraw"
        danger
        onConfirm={(reason) => withdraw.mutateAsync({ argumentId: argument.id, reason })}
      />
    </article>
  );
}

function Replies({ id, invalidate, depth }: { id: string; invalidate: Keys; depth: number }) {
  const { data, isPending } = useQuery(knowledgeQueries.argument(id));
  if (isPending) return <Skeleton lines={2} />;
  return (
    <div className={styles.replies}>
      {data?.replies.map((reply) => (
        <ArgumentCard
          key={reply.id}
          argument={reply}
          invalidate={[...invalidate, ["argument", id]]}
          depth={depth}
        />
      ))}
    </div>
  );
}

/** New argument: stance, a one-line claim of the argument, and the reasoning. */
export function ArgumentComposer({
  target,
  invalidate,
  onDone,
  compact,
}: {
  target: { kind: "idea" | "claim" | "argument"; id: string };
  invalidate: Keys;
  onDone?: () => void;
  compact?: boolean;
}) {
  const create = useCreateArgument(invalidate);
  const [stance, setStance] = useState<ArgumentStance>(target.kind === "argument" ? "opposes" : "supports");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const errors = isApiError(create.error) ? create.error.fieldErrors : {};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { target, stance, title: title.trim(), body: body.trim() },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          onDone?.();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className={cx(forms.form, forms.tight)}>
      <Fieldset legend={target.kind === "argument" ? "Your response" : "Your argument"}>
        <div className={forms.choices}>
          {ARGUMENT_STANCES.map((s) => (
            <label key={s} className={forms.choice}>
              <input
                type="radio"
                name={`stance-${target.id}`}
                checked={stance === s}
                onChange={() => setStance(s)}
              />
              <strong>{ARGUMENT_STANCE_INFO[s].label}</strong>
              {!compact && <span>{ARGUMENT_STANCE_INFO[s].description}</span>}
            </label>
          ))}
        </div>
      </Fieldset>
      <Field label="In one line" error={errors.title}>
        {(p) => (
          <input
            {...p}
            className={control}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={LIMITS.argumentTitle.min}
            maxLength={LIMITS.argumentTitle.max}
            required
          />
        )}
      </Field>
      <Field
        label="Reasoning"
        error={errors.body}
        hint="Make the strongest version of the case. Cite evidence where you can."
      >
        {(p) => (
          <textarea
            {...p}
            className={control}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            minLength={LIMITS.argumentBody.min}
            maxLength={LIMITS.argumentBody.max}
            required
            rows={compact ? 3 : 5}
          />
        )}
      </Field>
      <FormError error={create.error} />
      <div className={forms.actions}>
        {onDone && <Button onClick={onDone}>Cancel</Button>}
        <Button type="submit" variant="primary" loading={create.isPending}>
          Post argument
        </Button>
      </div>
    </form>
  );
}
