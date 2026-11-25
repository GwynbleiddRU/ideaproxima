import type { Context } from "hono";
import type { z } from "zod";
import { DomainError, notFound } from "@ideaproxima/domain";
import { isUuid } from "../lib/ids";
import { RequestValidationError } from "./validation";

export function parseWith<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new RequestValidationError(result.error.issues);
  return result.data;
}

/**
 * Reads and validates a JSON body. Requiring application/json is also a CSRF defence: browsers cannot send it
 * cross-site without a CORS preflight.
 */
export async function jsonBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  if (!(c.req.header("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new DomainError("validation_failed", "json_content_type_required");
  }
  let data: unknown;
  try {
    data = await c.req.json();
  } catch {
    throw new DomainError("validation_failed", "invalid_json");
  }
  return parseWith(schema, data);
}

export const queryOf = <S extends z.ZodType>(c: Context, schema: S): z.output<S> =>
  parseWith(schema, c.req.query());

/** A path parameter that must be a UUID. Anything else cannot exist, so it is a 404 rather than a 400. */
export function uuidParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value || !isUuid(value)) throw notFound("resource_not_found");
  return value.toLowerCase();
}

export function enumParam<T extends string>(c: Context, name: string, values: readonly T[]): T {
  const value = c.req.param(name);
  if (!value || !(values as readonly string[]).includes(value)) throw notFound("resource_not_found");
  return value as T;
}
