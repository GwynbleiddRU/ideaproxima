import { vocabularyField } from "@/lib/vocabulary";
import { useMessage } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { AttachEvidenceRequest } from "@ideaproxima/contracts";
import {
  EVIDENCE_STANCE_INFO,
  EVIDENCE_STANCES,
  LIMITS,
  OUTCOME_RESULT_INFO,
  SOURCE_KIND_INFO,
  SOURCE_KINDS,
  type EvidenceStance,
  type SourceKind,
} from "@ideaproxima/domain";
import { isApiError } from "@/api/http";
import { useAttachEvidence } from "@/api/knowledge";
import { practiceQueries } from "@/api/practice";
import forms from "@/components/forms.module.scss";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field, Fieldset } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import { Segmented } from "@/ui/Segmented";

/**
 * Attach evidence to a claim. Evidence always has a basis (a source, or an outcome recorded on the platform)
 * and the form asks what it does NOT establish: limitations are part of honest evidence.
 */
export function AddEvidenceDialog({
  open,
  onClose,
  claimId,
  claimStatement,
  ideaSlug,
}: {
  open: boolean;
  onClose: () => void;
  claimId: string;
  claimStatement: string;
  ideaSlug?: string;
}) {
  const t = useMessage();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t("idea.claim.attach")}
      description={t("addEvidence.forClaim", { claim: claimStatement })}
    >
      <EvidenceForm claimId={claimId} ideaSlug={ideaSlug} onDone={onClose} />
    </Dialog>
  );
}

function EvidenceForm({
  claimId,
  ideaSlug,
  onDone,
}: {
  claimId: string;
  ideaSlug?: string;
  onDone: () => void;
}) {
  const t = useMessage();
  const attach = useAttachEvidence(claimId, ideaSlug);
  const initiatives = useQuery({ ...practiceQueries.initiatives(ideaSlug ?? ""), enabled: !!ideaSlug });
  const outcomes = (initiatives.data ?? []).flatMap((i) =>
    i.outcomes.map((o) => ({ ...o, initiative: i.title })),
  );

  const [basis, setBasis] = useState<"source" | "outcome">("source");
  const [stance, setStance] = useState<EvidenceStance>("supports");
  const [summary, setSummary] = useState("");
  const [limitations, setLimitations] = useState("");
  const [locator, setLocator] = useState("");
  const [outcomeId, setOutcomeId] = useState("");
  const [source, setSource] = useState<{
    kind: SourceKind;
    title: string;
    authors: string;
    venue: string;
    year: string;
    doi: string;
    url: string;
  }>({ kind: "peer_reviewed_article", title: "", authors: "", venue: "", year: "", doi: "", url: "" });
  const errors = isApiError(attach.error) ? attach.error.fieldErrors : {};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const base = {
      stance,
      summary: summary.trim(),
      limitations: limitations.trim() || undefined,
      locator: locator.trim() || undefined,
    };
    const input: AttachEvidenceRequest =
      basis === "outcome"
        ? { ...base, outcomeId }
        : {
            ...base,
            source: {
              kind: source.kind,
              title: source.title.trim(),
              authors: source.authors.trim() || undefined,
              venue: source.venue.trim() || undefined,
              year: source.year ? Number(source.year) : undefined,
              doi: source.doi.trim() || undefined,
              url: source.url.trim() || undefined,
            },
          };
    attach.mutate(input, { onSuccess: onDone });
  };

  const setField = (key: keyof typeof source) => (e: { target: { value: string } }) =>
    setSource({ ...source, [key]: e.target.value });

  return (
    <form onSubmit={submit} className={forms.form}>
      <Fieldset legend={t("addEvidence.stance")}>
        <div className={forms.choices}>
          {EVIDENCE_STANCES.map((s) => (
            <label key={s} className={forms.choice}>
              <input type="radio" name="stance" checked={stance === s} onChange={() => setStance(s)} />
              <strong>{vocabularyField("evidenceStances", s, "label", EVIDENCE_STANCE_INFO[s].label)}</strong>
              <span>
                {vocabularyField("evidenceStances", s, "description", EVIDENCE_STANCE_INFO[s].description)}
              </span>
            </label>
          ))}
        </div>
      </Fieldset>

      {outcomes.length > 0 && (
        <Segmented
          label={t("addEvidence.basis")}
          value={basis}
          onChange={setBasis}
          options={[
            { value: "source", label: t("addEvidence.aPublicationOrSource") },
            { value: "outcome", label: t("addEvidence.anOutcomeRecordedHere") },
          ]}
        />
      )}

      {basis === "source" ? (
        <>
          <div className={forms.row}>
            <Field label={t("addEvidence.kindOfSource")}>
              {(p) => (
                <select {...p} className={control} value={source.kind} onChange={setField("kind")}>
                  {SOURCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {vocabularyField("sourceKinds", k, "label", SOURCE_KIND_INFO[k].label)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("addEvidence.year")} optional error={errors["source.year"]}>
              {(p) => (
                <input
                  {...p}
                  className={control}
                  type="number"
                  min={1000}
                  max={2200}
                  value={source.year}
                  onChange={setField("year")}
                />
              )}
            </Field>
          </div>
          <Field label={t("common.title")} error={errors["source.title"]}>
            {(p) => (
              <input
                {...p}
                className={control}
                value={source.title}
                onChange={setField("title")}
                required
                minLength={3}
                maxLength={500}
              />
            )}
          </Field>
          <div className={forms.row}>
            <Field label={t("addEvidence.authors")} optional>
              {(p) => (
                <input
                  {...p}
                  className={control}
                  value={source.authors}
                  onChange={setField("authors")}
                  maxLength={1000}
                />
              )}
            </Field>
            <Field label={t("addEvidence.journalPublisherOrVenue")} optional>
              {(p) => (
                <input
                  {...p}
                  className={control}
                  value={source.venue}
                  onChange={setField("venue")}
                  maxLength={300}
                />
              )}
            </Field>
          </div>
          <div className={forms.row}>
            <Field label={t("idea.claim.doi")} optional hint={t("addEvidence.deduplicationHint")}>
              {(p) => (
                <input
                  {...p}
                  className={control}
                  value={source.doi}
                  onChange={setField("doi")}
                  placeholder={t("common.doiExample")}
                  maxLength={200}
                />
              )}
            </Field>
            <Field label={t("addEvidence.url")} optional error={errors["source.url"]}>
              {(p) => (
                <input
                  {...p}
                  className={control}
                  type="url"
                  value={source.url}
                  onChange={setField("url")}
                  placeholder={t("common.urlExample")}
                />
              )}
            </Field>
          </div>
        </>
      ) : (
        <Field label={t("addEvidence.outcome")}>
          {(p) => (
            <select
              {...p}
              className={control}
              value={outcomeId}
              onChange={(e) => setOutcomeId(e.target.value)}
              required
            >
              <option value="">{t("addEvidence.chooseAnOutcome")}</option>
              {outcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.initiative}:{" "}
                  {vocabularyField("outcomeResults", o.result, "label", OUTCOME_RESULT_INFO[o.result].label)}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field
        label={t("addEvidence.summary")}
        error={errors.summary}
        counter={`${summary.length} / ${LIMITS.evidenceSummary.max}`}
      >
        {(p) => (
          <textarea
            {...p}
            className={control}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            minLength={LIMITS.evidenceSummary.min}
            maxLength={LIMITS.evidenceSummary.max}
            required
            rows={3}
          />
        )}
      </Field>
      <Field label={t("addEvidence.limitations")} optional hint={t("addEvidence.limitationsHint")}>
        {(p) => (
          <textarea
            {...p}
            className={control}
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            maxLength={LIMITS.evidenceSummary.max}
            rows={2}
          />
        )}
      </Field>
      <Field label={t("addEvidence.locator")} optional hint={t("addEvidence.locatorHint")}>
        {(p) => (
          <input
            {...p}
            className={control}
            value={locator}
            onChange={(e) => setLocator(e.target.value)}
            maxLength={200}
          />
        )}
      </Field>
      <FormError error={attach.error} />
      <div className={forms.actions}>
        <Button onClick={onDone}>{t("common.cancel")}</Button>
        <Button type="submit" variant="primary" loading={attach.isPending}>
          {t("idea.claim.attach")}
        </Button>
      </div>
    </form>
  );
}
