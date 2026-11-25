import { vocabularyField } from "@/lib/vocabulary";
import { vocabularyText } from "@/locales/runtime";
import { useMessage } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { IdeaDetail } from "@ideaproxima/contracts";
import { IDEA_STAGE_INFO, IDEA_STAGES, LIMITS, stageProofReason, type IdeaStage } from "@ideaproxima/domain";
import { useTransitionStage } from "@/api/ideas";
import { practiceQueries } from "@/api/practice";
import forms from "@/components/forms.module.scss";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field, Fieldset } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";

/**
 * Record a lifecycle stage change. Later stages need proof (a recorded initiative or outcome); the API checks it
 * and the dialog shows each stage's requirement up front, so nobody is surprised by a refusal.
 */
export function StageDialog({
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
      title={t("stageDialog.recordAStageChange")}
      description={t("stageDialog.description")}
    >
      <StageForm idea={idea} onDone={onClose} />
    </Dialog>
  );
}

function StageForm({ idea, onDone }: { idea: IdeaDetail; onDone: () => void }) {
  const t = useMessage();
  const requirements = new Map(idea.stageRequirements.map((r) => [r.stage, r]));
  const [to, setTo] = useState<IdeaStage | null>(null);
  const [rationale, setRationale] = useState("");
  const [initiativeId, setInitiativeId] = useState("");
  const initiatives = useQuery(practiceQueries.initiatives(idea.slug));
  const transition = useTransitionStage(idea.slug);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!to) return;
    transition.mutate(
      { to, rationale: rationale.trim(), initiativeId: initiativeId || undefined },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={submit} className={forms.form}>
      <Fieldset
        legend={t("stageDialog.newStage")}
        hint={t("stageDialog.currentStage", {
          stage: vocabularyField("stages", idea.stage, "label", IDEA_STAGE_INFO[idea.stage].label),
        })}
      >
        <div className={forms.choices}>
          {IDEA_STAGES.filter((s) => s !== idea.stage).map((s) => {
            const req = requirements.get(s);
            const proof = stageProofReason(s);
            return (
              <label key={s} className={forms.choice}>
                <input type="radio" name="stage" checked={to === s} onChange={() => setTo(s)} />
                <strong>{vocabularyField("stages", s, "label", IDEA_STAGE_INFO[s].label)}</strong>
                <span>
                  {req
                    ? req.met
                      ? t("stageDialog.requirementMet")
                      : t("stageDialog.needsProof", {
                          requirement: proof
                            ? vocabularyText(`errors.${proof}`, req.requirement)
                            : req.requirement,
                        })
                    : vocabularyField("stages", s, "description", IDEA_STAGE_INFO[s].description)}
                </span>
              </label>
            );
          })}
        </div>
      </Fieldset>
      <Field label={t("stageDialog.rationale")} hint={t("stageDialog.rationaleHint")}>
        {(p) => (
          <textarea
            {...p}
            className={control}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            maxLength={LIMITS.rationale.max}
            required
            rows={3}
          />
        )}
      </Field>
      {(initiatives.data?.length ?? 0) > 0 && (
        <Field label={t("stageDialog.motivatingInitiative")} optional hint={t("stageDialog.initiativeHint")}>
          {(p) => (
            <select
              {...p}
              className={control}
              value={initiativeId}
              onChange={(e) => setInitiativeId(e.target.value)}
            >
              <option value="">{t("stageDialog.none")}</option>
              {initiatives.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <FormError error={transition.error} />
      <div className={forms.actions}>
        <Button onClick={onDone}>{t("common.cancel")}</Button>
        <Button
          type="submit"
          variant="primary"
          retryError={transition.error}
          loading={transition.isPending}
          disabled={!to || !rationale.trim()}
        >
          {t("stageDialog.recordStage")}
        </Button>
      </div>
    </form>
  );
}
