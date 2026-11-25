import { vocabularyField } from "@/lib/vocabulary";
import { useLocale } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { AddClaimRequest, IdeaDetail } from "@ideaproxima/contracts";
import {
  CLAIM_ROLE_INFO,
  CLAIM_ROLES,
  CONFIDENCE_LEVELS,
  CONSEQUENCE_DEPTH_INFO,
  CONSEQUENCE_DEPTHS,
  DIMENSIONS,
  LIMITS,
  type ClaimRole,
  type ConfidenceLevel,
} from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { isApiError } from "@/api/http";
import { useAddClaim } from "@/api/knowledge";
import forms from "@/components/forms.module.scss";
import { useDebounced } from "@/lib/hooks";
import { anchorsOf } from "@/lib/vocabulary";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field, Fieldset } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import { Segmented } from "@/ui/Segmented";

/** Add a claim to an idea: state a new one, or link a claim that already exists (claims are shared). */
export function AddClaimDialog({
  open,
  onClose,
  idea,
}: {
  open: boolean;
  onClose: () => void;
  idea: IdeaDetail;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Add a claim"
      description="A claim is one statement the idea depends on, phrased so that evidence could support or challenge it."
    >
      <ClaimForm idea={idea} onDone={onClose} />
    </Dialog>
  );
}

function ClaimForm({ idea, onDone }: { idea: IdeaDetail; onDone: () => void }) {
  useLocale();
  const add = useAddClaim(idea.slug);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [statement, setStatement] = useState("");
  const [search, setSearch] = useState("");
  const [claimId, setClaimId] = useState("");
  const [role, setRole] = useState<ClaimRole>("premise");
  const [depth, setDepth] = useState(1);
  const [support, setSupport] = useState("");
  const [plausibility, setPlausibility] = useState("");
  const [confidence, setConfidence] = useState<ConfidenceLevel | "">("");
  const q = useDebounced(search.trim());
  const results = useQuery({ ...catalogQueries.search(q), enabled: mode === "existing" && q.length > 1 });
  const errors = isApiError(add.error) ? add.error.fieldErrors : {};
  const hasDepth = role === "consequence" || role === "risk";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const assessment =
      support || plausibility
        ? {
            support: support ? Number(support) : undefined,
            plausibility: plausibility ? Number(plausibility) : undefined,
            confidence: confidence || undefined,
          }
        : undefined;
    const input: AddClaimRequest = {
      ...(mode === "new" ? { statement: statement.trim() } : { claimId }),
      role,
      depth: hasDepth ? depth : undefined,
      assessment,
    };
    add.mutate(input, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className={forms.form}>
      <Segmented
        label="New or existing claim"
        value={mode}
        onChange={setMode}
        options={[
          { value: "new", label: "State a new claim" },
          { value: "existing", label: "Link an existing claim" },
        ]}
      />
      {mode === "new" ? (
        <Field
          label="Statement"
          error={errors.statement}
          counter={`${statement.length} / ${LIMITS.claimStatement.max}`}
          hint="One checkable statement. “Membranes can selectively capture microplastics below 5 µm”, not “this will work”."
        >
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              minLength={LIMITS.claimStatement.min}
              maxLength={LIMITS.claimStatement.max}
              required
              rows={3}
            />
          )}
        </Field>
      ) : (
        <Fieldset legend="Find the claim">
          <input
            className={control}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search claim statements"
            aria-label="Search claims"
          />
          <div className={forms.choices}>
            {(results.data?.claims ?? []).map((c) => (
              <label key={c.id} className={forms.choice}>
                <input
                  type="radio"
                  name="claim"
                  checked={claimId === c.id}
                  onChange={() => setClaimId(c.id)}
                  required
                />
                <strong>{c.statement}</strong>
                <span>
                  Used by {c.ideaCount} idea{c.ideaCount === 1 ? "" : "s"}
                </span>
              </label>
            ))}
          </div>
          {q.length > 1 && results.data && !results.data.claims.length && (
            <p className={forms.note}>No claims match. State a new one instead.</p>
          )}
        </Fieldset>
      )}

      <Fieldset legend="Its role in this idea">
        <div className={forms.choices}>
          {CLAIM_ROLES.map((r) => (
            <label key={r} className={forms.choice}>
              <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} />
              <strong>{vocabularyField("claimRoles", r, "label", CLAIM_ROLE_INFO[r].label)}</strong>
              <span>{vocabularyField("claimRoles", r, "description", CLAIM_ROLE_INFO[r].description)}</span>
            </label>
          ))}
        </div>
      </Fieldset>

      {hasDepth && (
        <Fieldset legend="How far down the chain of consequences?">
          <div className={forms.choices}>
            {CONSEQUENCE_DEPTHS.map((d) => (
              <label key={d} className={forms.choice}>
                <input type="radio" name="depth" checked={depth === d} onChange={() => setDepth(d)} />
                <strong>
                  {vocabularyField("consequenceDepths", d, "label", CONSEQUENCE_DEPTH_INFO[d].label)}
                </strong>
                <span>
                  {vocabularyField(
                    "consequenceDepths",
                    d,
                    "description",
                    CONSEQUENCE_DEPTH_INFO[d].description,
                  )}
                </span>
              </label>
            ))}
          </div>
        </Fieldset>
      )}

      <Fieldset
        legend="Your own assessment"
        hint="Optional. Recorded as an ordinary, attributed evaluation of the claim."
      >
        <div className={forms.row}>
          {(["support", "plausibility"] as const).map((d) => (
            <Field key={d} label={vocabularyField("dimensions", d, "label", DIMENSIONS[d].label)} optional>
              {(p) => (
                <select
                  {...p}
                  className={control}
                  value={d === "support" ? support : plausibility}
                  onChange={(e) => (d === "support" ? setSupport : setPlausibility)(e.target.value)}
                >
                  <option value="">I don't know</option>
                  {anchorsOf(d).map(([n, label]) => (
                    <option key={n} value={n}>
                      {n} — {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ))}
          <Field label="Confidence" optional>
            {(p) => (
              <select
                {...p}
                className={control}
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as ConfidenceLevel | "")}
              >
                <option value="">Unsure</option>
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </Fieldset>

      <FormError error={add.error} />
      <div className={forms.actions}>
        <Button onClick={onDone}>Cancel</Button>
        <Button
          type="submit"
          variant="primary"
          loading={add.isPending}
          disabled={mode === "existing" && !claimId}
        >
          Add claim
        </Button>
      </div>
    </form>
  );
}
