declare module "virtual:web-catalogues" {
  import type { Messages } from "@lingui/core";
  import type { Locale } from "@ideaproxima/i18n/locales";

  export const loadCatalogue: (locale: Locale) => Promise<{
    english: Messages;
    translated: Messages;
  }>;
}

declare module "virtual:web-extended-english" {
  import type { Messages } from "@lingui/core";

  const messages: Messages;
  export default messages;
}
