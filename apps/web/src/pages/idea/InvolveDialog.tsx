import { vocabularyField } from "@/lib/vocabulary";
import { useMessage } from "@/locales/react";
import { useState, type FormEvent } from "react";
import type { IdeaDetail } from "@ideaproxima/contracts";
import {
  CAPACITIES,
  CAPACITY_INFO,
  INVOLVEMENT_STATUS_INFO,
  INVOLVEMENT_STATUSES,
  type Capacity,
  type InvolvementStatus,
} from "@ideaproxima/domain";
import { useDeclareInvolvement, useWithdrawInvolvement } from "@/api/signals";
import forms from "@/components/forms.module.scss";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field, Fieldset } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";

/**
 * "I can help": the matching surface between ideas and the people who could advance them. An involvement
 * states a capacity (research, funding…) and a status (offering, active, concluded), and is public.
 */
export function InvolveDialog({
  open,
  onClose,
  idea,
}: {
  open: boolean;
  onClose: () => void;
  idea: IdeaDetail;
}) {
  const t = useMessage();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("involve.howCanYouHelp")}
      description={t("involve.description")}
    >
      <InvolveForm idea={idea} onDone={onClose} />
    </Dialog>
  );
}

function InvolveForm({ idea, onDone }: { idea: IdeaDetail; onDone: () => void }) {
  const t = useMessage();
  const existing = idea.viewer?.involvements ?? [];
  const [capacity, setCapacity] = useState<Capacity>(existing[0]?.capacity ?? "research");
  const current = existing.find((i) => i.capacity === capacity);
  const [status, setStatus] = useState<InvolvementStatus>(current?.status ?? "offering");
  const [note, setNote] = useState("");
  const declare = useDeclareInvolvement(idea.slug);
  const withdraw = useWithdrawInvolvement(idea.slug);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    declare.mutate({ capacity, status, note: note.trim() || undefined }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className={forms.form}>
      <Fieldset legend={t("involve.inWhatCapacity")}>
        <div className={forms.choices}>
          {CAPACITIES.map((c) => (
            <label key={c} className={forms.choice}>
              <input
                type="radio"
                name="capacity"
                checked={capacity === c}
                onChange={() => {
                  setCapacity(c);
                  setStatus(existing.find((i) => i.capacity === c)?.status ?? "offering");
                }}
              />
              <strong>
                {vocabularyField("capacities", c, "label", CAPACITY_INFO[c].label)}
                {existing.some((i) => i.capacity === c) ? " ✓" : ""}
              </strong>
              <span>{vocabularyField("capacities", c, "description", CAPACITY_INFO[c].description)}</span>
            </label>
          ))}
        </div>
      </Fieldset>
      <Fieldset legend={t("involve.whereDoYouStand")}>
        <div className={forms.choices}>
          {INVOLVEMENT_STATUSES.map((s) => (
            <label key={s} className={forms.choice}>
              <input type="radio" name="status" checked={status === s} onChange={() => setStatus(s)} />
              <strong>
                {vocabularyField("involvementStatuses", s, "label", INVOLVEMENT_STATUS_INFO[s].label)}
              </strong>
              <span>
                {vocabularyField(
                  "involvementStatuses",
                  s,
                  "description",
                  INVOLVEMENT_STATUS_INFO[s].description,
                )}
              </span>
            </label>
          ))}
        </div>
      </Fieldset>
      <Field label={t("common.note")} optional hint={t("involve.noteHint")}>
        {(p) => (
          <textarea
            {...p}
            className={control}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
          />
        )}
      </Field>
      <FormError error={declare.error} />
      <div className={`${forms.actions} ${forms.actionsSpread}`}>
        {current ? (
          <Button
            variant="quiet"
            retryError={withdraw.error}
            loading={withdraw.isPending}
            onClick={() => withdraw.mutate(capacity, { onSuccess: onDone })}
          >
            {t("involve.withdraw", {
              capacity: vocabularyField(
                "capacities",
                capacity,
                "label",
                CAPACITY_INFO[capacity].label,
              ).toLowerCase(),
            })}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" retryError={declare.error} loading={declare.isPending}>
          {current ? t("involve.update") : t("involve.recordMyInvolvement")}
        </Button>
      </div>
    </form>
  );
}
