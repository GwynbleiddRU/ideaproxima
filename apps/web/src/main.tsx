import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/literata/wght.css";
import "@fontsource-variable/literata/wght-italic.css";
import "./styles/global.scss";

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createQueryClient } from "./app/query-client";
import { createAppRouter } from "./app/router";
import { readLocalePreference, resolveLocale } from "./locales/preferences";
import { activateLocale } from "./locales/runtime";

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

const explicit = new URLSearchParams(location.search).get("hl") ?? undefined;
const locale = resolveLocale(explicit, readLocalePreference(), undefined, navigator.languages);
try {
  await activateLocale(locale);
} catch (error) {
  if (locale === "en") throw error;
  await activateLocale("en");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
