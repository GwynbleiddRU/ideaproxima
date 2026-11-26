import { createTranslator, localeInfo, type Locale } from "@ideaproxima/i18n";
import type { TokenPurpose } from "../../../db/schema";

export type MailTemplate = TokenPurpose | "email_change_notice" | "password_changed" | "existing_account";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderAccountMail(template: MailTemplate, locale: Locale, name: string, link?: string) {
  const t = createTranslator(locale);
  const subject = t(`emails.${template}`);
  const greeting = t("emails.greeting", { name });
  const body = t(`emails.${template}Body`);
  const action = link ? `<p><a href="${escapeHtml(link)}">${escapeHtml(subject)}</a></p>` : "";
  return {
    subject,
    text: [greeting, body, link].filter(Boolean).join("\n\n"),
    html: `<!doctype html><html lang="${escapeHtml(locale)}" dir="${escapeHtml(localeInfo(locale).direction)}"><body><p>${escapeHtml(greeting)}</p><p>${escapeHtml(body)}</p>${action}</body></html>`,
  };
}
