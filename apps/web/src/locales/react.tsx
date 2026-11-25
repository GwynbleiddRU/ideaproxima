import { I18nProvider, useLingui } from "@lingui/react";
import { TransNoContext, type TransProps } from "@lingui/react/server";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/api/session";
import type { MessageId } from "./messages";
import { readLocalePreference, resolveLocale } from "./preferences";
import { activateLocale, activeLocale, message, messageCatalogue, webI18n } from "./runtime";

/** The root route wraps both the normal shell and its error boundaries in the locale context. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { locale: account } = useSession();
  const explicit = useRouterState({ select: (state) => state.location.searchStr });
  useEffect(() => {
    const update = () => {
      const requested = new URLSearchParams(explicit).get("hl") ?? undefined;
      const locale = resolveLocale(
        requested,
        readLocalePreference(),
        account ?? undefined,
        navigator.languages,
      );
      void activateLocale(locale).catch(() => {
        // Keep the current catalogue if a network failure prevents loading a new one.
      });
    };
    update();
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [account, explicit]);
  return <I18nProvider i18n={webI18n}>{children}</I18nProvider>;
}

export function useMessage() {
  useLingui();
  return message;
}

export function useLocale() {
  useLingui();
  return activeLocale();
}

export function LocalizedText({
  id,
  ...props
}: Pick<TransProps, "components" | "values"> & { id: MessageId }) {
  useLingui();
  const i18n = messageCatalogue(id);
  // Select the fallback for this message alone. Nested messages still follow the active locale.
  return <TransNoContext id={id} {...props} lingui={{ i18n }} />;
}
