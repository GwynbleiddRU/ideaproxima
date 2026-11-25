import type { Context } from "hono";
import { matchLocale, negotiateLocale, type Locale } from "@ideaproxima/i18n";
import type { AppEnv } from "./env";

export function setRequestLocale(c: Context<AppEnv>, saved?: Locale | null): void {
  c.set(
    "locale",
    matchLocale(c.req.query("locale")) ?? saved ?? negotiateLocale(c.req.header("accept-language")),
  );
}

export function requestLocale(c: Context<AppEnv>): Locale {
  // Network and body limits can reject a request before session resolution.
  if (!c.get("locale")) setRequestLocale(c);
  return c.get("locale")!;
}

export function localizedResponseHeaders(c: Context<AppEnv>): void {
  c.header("Content-Language", requestLocale(c));
  c.header("Vary", "Accept-Language, Cookie, Authorization", { append: true });
  if (c.get("sessionId")) c.header("Cache-Control", "private, no-store");
}
