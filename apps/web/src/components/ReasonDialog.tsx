import { useState, type FormEvent, type ReactNode } from "react";
import { LIMITS } from "@ideaproxima/domain";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import forms from "./forms.module.scss";

/**
 * Asks for a reason before an action that is recorded publicly (withdrawing a contribution, moderation). The
 * reason is part of the permanent record, so the dialog says so.
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="sm">
      <form onSubmit={submit} className={forms.form}>
        <Field label="Reason" hint="Recorded publicly with this action.">
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={LIMITS.rationale.max}
              required
              rows={3}
              autoFocus
            />
          )}
        </Field>
        <FormError error={error} />
        <div className={forms.actions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
