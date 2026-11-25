import { vocabularyField } from "@/lib/vocabulary";
import { useLocale } from "@/locales/react";
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
      title={`Evaluate “${subject}”`}
      description="Rate only what you can judge — every dimension is optional and stays separate."
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
  useLocale();
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
    <form onSubmit={onSubmit} className={styles.form}>
      {dimensions.map((d) => {
        const definition = DIMENSIONS[d];
        const value = values[d]?.value ?? null;
        const anchors = anchorsOf(d);
        return (
          <fieldset key={d} className={cx(styles.dimension, value === null && styles.skipped)}>
            <legend className={styles.legend}>
              {vocabularyField("dimensions", d, "label", definition.label)}
            </legend>
            <div className={styles.head}>
              <p className={styles.question}>
                {vocabularyField("dimensions", d, "question", definition.question)}
              </p>
              <label className={styles.skip}>
                <input
                  type="radio"
                  name={d}
                  checked={value === null}
                  onChange={() => set(d, { value: null })}
                  className="visually-hidden"
                />
                I don't know
              </label>
            </div>
            <div className={styles.scale}>
              {anchors.map(([n, label]) => (
                <label key={n} className={styles.point}>
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
            </div>
            {value !== null && (
              <div className={styles.confidence}>
                {/* On narrow screens the scale shows numbers only; name the chosen point here. */}
                <span className={styles.chosen}>
                  {value} — {anchors.find(([n]) => n === value)?.[1]}
                </span>
                <span>How sure are you?</span>
                <Segmented<ConfidenceLevel | "unset">
                  label={`Confidence in your ${vocabularyField("dimensions", d, "label", definition.label).toLowerCase()} rating`}
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
        label="Why?"
        optional
        hint="What your ratings rest on — a source, an experience, a calculation. Shown with them."
      >
        {(p) => (
          <textarea
            {...p}
            className={control}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            maxLength={LIMITS.rationale.max}
            rows={2}
          />
        )}
      </Field>
      <FormError error={submit.error} />

      <div className={styles.footer}>
        <p className={styles.count}>
          <b>
            {ratings.length} of {dimensions.length}
          </b>{" "}
          rated{ratings.length < dimensions.length && " · the rest stay “I don't know”"}
        </p>
        <div className={styles.buttons}>
          {mine.length > 0 && (
            <Button
              variant="quiet"
              size="sm"
              loading={withdraw.isPending}
              onClick={() =>
                withdraw.mutate([...new Set(mine.map((e) => e.dimension))], { onSuccess: onDone })
              }
            >
              Withdraw mine
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submit.isPending}
            disabled={ratings.length === 0}
          >
            {mine.length ? "Update evaluation" : "Save evaluation"}
          </Button>
        </div>
      </div>
    </form>
  );
}
