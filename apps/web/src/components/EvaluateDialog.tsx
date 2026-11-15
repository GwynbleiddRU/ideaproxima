import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { EvaluationTarget } from "@ideaproxima/contracts";
import {
  CONFIDENCE_LEVELS,
  DIMENSIONS,
  dimensionsFor,
  LIMITS,
  type ConfidenceLevel,
  type DimensionKey,
} from "@ideaproxima/domain";
import { useSession } from "@/api/session";
import { signalQueries, useSubmitEvaluation, useWithdrawEvaluation } from "@/api/signals";
import { cx } from "@/lib/cx";
import { anchorsOf } from "@/lib/vocabulary";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field } from "@/ui/Field";
import { FormError, LoadingBlock } from "@/ui/Feedback";
import { Segmented } from "@/ui/Segmented";
import styles from "./EvaluateDialog.module.scss";
import forms from "./forms.module.scss";

type Draft = Partial<Record<DimensionKey, { value: number | null; confidence: ConfidenceLevel | null }>>;

/**
 * Rate something on each of its dimensions. Every dimension can be skipped ("I don't know" is an honest
 * answer, not a low score); a confidence level and a rationale make the rating more useful to others.
 * Re-rating supersedes your previous rating; history is kept.
 */
export function EvaluateDialog({
  open,
  onClose,
  target,
  subject,
  invalidate = [],
}: {
  open: boolean;
  onClose: () => void;
  target: EvaluationTarget;
  /** What is being rated, shown in the title. */
  subject: string;
  invalidate?: readonly (readonly unknown[])[];
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={`Evaluate: ${subject}`}
      description="Rate only what you can judge. Each dimension is kept separate; nothing is combined into one score."
    >
      <EvaluateForm target={target} invalidate={invalidate} onDone={onClose} />
    </Dialog>
  );
}

function EvaluateForm({
  target,
  invalidate,
  onDone,
}: {
  target: EvaluationTarget;
  invalidate: readonly (readonly unknown[])[];
  onDone: () => void;
}) {
  const { me } = useSession();
  const current = useQuery(signalQueries.evaluations(target));
  const dimensions = dimensionsFor(target.kind).filter((d) => DIMENSIONS[d].scale.kind === "ordinal");
  const submit = useSubmitEvaluation(target, invalidate);
  const withdraw = useWithdrawEvaluation(target, invalidate);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rationale, setRationale] = useState("");

  if (current.isPending) return <LoadingBlock />;

  const mine = (current.data?.items ?? []).filter((e) => e.evaluator.id === me?.id);
  const initial: Draft = Object.fromEntries(
    mine.map((e) => [e.dimension, { value: e.value, confidence: e.confidence }]),
  );
  const values = draft ?? initial;
  const set = (
    d: DimensionKey,
    patch: Partial<{ value: number | null; confidence: ConfidenceLevel | null }>,
  ) => setDraft({ ...values, [d]: { value: null, confidence: null, ...values[d], ...patch } });

  const ratings = dimensions.flatMap((d) => {
    const v = values[d];
    return v?.value != null ? [{ dimension: d, value: v.value, confidence: v.confidence ?? undefined }] : [];
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate({ ratings, rationale: rationale.trim() || undefined }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={onSubmit} className={forms.form}>
      {dimensions.map((d) => {
        const definition = DIMENSIONS[d];
        const value = values[d]?.value ?? null;
        return (
          <fieldset key={d} className={styles.dimension}>
            <legend className={styles.legend}>{definition.label}</legend>
            <p className={styles.question}>{definition.question}</p>
            <div className={styles.scale} role="radiogroup" aria-label={definition.label}>
              {anchorsOf(d).map(([n, label]) => (
                <label key={n} className={cx(styles.point, value === n && styles.selected)}>
                  <input
                    type="radio"
                    name={d}
                    checked={value === n}
                    onChange={() => set(d, { value: n })}
                    className="visually-hidden"
                  />
                  <span className={styles.pointValue}>{n}</span>
                  <span className={styles.pointLabel}>{label}</span>
                </label>
              ))}
              <label className={cx(styles.point, styles.skip, value === null && styles.selected)}>
                <input
                  type="radio"
                  name={d}
                  checked={value === null}
                  onChange={() => set(d, { value: null })}
                  className="visually-hidden"
                />
                <span className={styles.pointLabel}>I don't know</span>
              </label>
            </div>
            {value !== null && (
              <div className={styles.confidence}>
                <span>How confident are you?</span>
                <Segmented<ConfidenceLevel | "unset">
                  label={`Confidence in your ${definition.label.toLowerCase()} rating`}
                  size="sm"
                  value={values[d]?.confidence ?? "unset"}
                  onChange={(c) => set(d, { confidence: c === "unset" ? null : c })}
                  options={[
                    { value: "unset", label: "Unsure" },
                    ...CONFIDENCE_LEVELS.map((c) => ({ value: c, label: c[0]!.toUpperCase() + c.slice(1) })),
                  ]}
                />
              </div>
            )}
          </fieldset>
        );
      })}

      <Field
        label="Rationale"
        optional
        hint="Why you rated this way. Shown with your ratings; helps others weigh them."
      >
        {(p) => (
          <textarea
            {...p}
            className={control}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            maxLength={LIMITS.rationale.max}
            rows={3}
          />
        )}
      </Field>

      <FormError error={submit.error} />
      <div className={cx(forms.actions, forms.actionsSpread)}>
        {mine.length > 0 ? (
          <Button
            variant="quiet"
            loading={withdraw.isPending}
            onClick={() => withdraw.mutate([...new Set(mine.map((e) => e.dimension))], { onSuccess: onDone })}
          >
            Withdraw my ratings
          </Button>
        ) : (
          <span className={forms.note}>Your ratings are public and attributed to you.</span>
        )}
        <Button type="submit" variant="primary" loading={submit.isPending} disabled={ratings.length === 0}>
          {mine.length ? "Update ratings" : "Submit ratings"}
        </Button>
      </div>
    </form>
  );
}
