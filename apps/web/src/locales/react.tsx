import { I18nProvider, Trans, useLingui } from "@lingui/react";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { useSession } from "@/api/session";
import type { MessageId } from "./messages";
import { readLocalePreference, resolveLocale } from "./preferences";
import { activateLocale, activeLocale, message, messageCatalogue, webI18n } from "./runtime";

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
}: Pick<ComponentProps<typeof Trans>, "components" | "values"> & { id: MessageId }) {
  useLingui();
  const catalogue = messageCatalogue(id);
  const text = <Trans id={id} {...props} />;
  return catalogue === webI18n ? text : <I18nProvider i18n={catalogue}>{text}</I18nProvider>;
}
