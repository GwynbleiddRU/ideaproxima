import { LocalizedText } from "@/locales/react";
import forms from "./forms.module.scss";

export function TermsConfirmation() {
  return (
    <label className={forms.confirmation}>
      <input type="checkbox" name="acceptTerms" required />
      <span>
        <LocalizedText
          id="auth.termsConfirmation"
          components={{
            0: <a className="link" href="/policies/terms" target="_blank" rel="noreferrer" />,
            1: <a className="link" href="/policies/privacy" target="_blank" rel="noreferrer" />,
          }}
        />
      </span>
    </label>
  );
}
