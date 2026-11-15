/**
 * The one place the web app talks HTTP. Same-origin requests to /v1; the session is the HttpOnly cookie the API
 * sets on login, so no token is ever readable by scripts.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field path → message, from a `validation_failed` response (`details.issues`). */
  get fieldErrors(): Record<string, string> {
    const issues = (this.details as { issues?: { path: string; message: string }[] } | undefined)?.issues;
    const out: Record<string, string> = {};
    for (const issue of issues ?? []) out[issue.path] ??= issue.message;
    return out;
  }
}

export const isApiError = (e: unknown, status?: number): e is ApiError =>
  e instanceof ApiError && (status === undefined || e.status === status);

/** A message fit for a person: the API's own message, or a calm fallback for network failures. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Please sign in to do that.";
    if (error.status === 429) return "Too many requests. Please wait a moment and try again.";
    const issues = Object.entries(error.fieldErrors);
    if (error.code === "validation_failed" && issues.length) {
      return `Please check: ${issues.map(([path, message]) => `${humanizePath(path)} — ${message}`).join("; ")}`;
    }
    return error.message;
  }
  return "Could not reach the server. Check your connection and try again.";
}

/** "source.title" → "source title", "sections.overview" → "sections overview". */
const humanizePath = (path: string) => (path ? path.replace(/[._]/g, " ") : "request");

type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

function url(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `/v1${path}${qs ? `?${qs}` : ""}`;
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; query?: Query; signal?: AbortSignal } = {},
): Promise<T> {
  const hasBody = options.body !== undefined;
  const response = await fetch(url(path, options.query), {
    method,
    credentials: "same-origin",
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "http_error",
      error?.message ?? response.statusText,
      error?.details,
    );
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>("GET", path, { query, signal }),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, { body }),
  put: <T>(path: string, body: unknown = {}) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
