/**
 * Builds an OpenAPI 3.1 document from the endpoint catalogue and the request/response schemas. Pure and
 * deterministic: the API serves it at /v1/openapi.json and `npm run docs:api` writes it to docs/developer/api/.
 */
import { z } from "zod";
import { ENDPOINTS, PATH_PARAMS, TAGS, type EndpointSpec } from "./endpoints";
import { requestRegistry } from "./requests";
import { responseRegistry } from "./responses";

type Json = Record<string, unknown>;

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const FORMATS_WITHOUT_PATTERN = new Set(["uuid", "date-time", "date", "email", "uri"]);

/** Strips generator noise so the document stays readable: $schema/$id, and regexes behind well-known formats. */
function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== "object") return node;
  const out: Json = {};
  for (const [key, value] of Object.entries(node as Json)) {
    if (key === "$schema" || key === "$id") continue;
    if (key === "pattern" && FORMATS_WITHOUT_PATTERN.has(String((node as Json).format))) continue;
    // zod's .int() emits the safe-integer range as bounds; they carry no information for readers.
    if (
      (key === "minimum" && value === Number.MIN_SAFE_INTEGER) ||
      (key === "maximum" && value === Number.MAX_SAFE_INTEGER)
    )
      continue;
    out[key] = clean(value);
  }
  return out;
}

function componentSchemas(): Record<string, Json> {
  const uri = (id: string) => `#/components/schemas/${id}`;
  const responses = z.toJSONSchema(responseRegistry, { uri, io: "output", unrepresentable: "any" }).schemas;
  const requests = z.toJSONSchema(requestRegistry, { uri, io: "input", unrepresentable: "any" }).schemas;
  const all: Record<string, Json> = {};
  for (const [id, schema] of [...Object.entries(responses), ...Object.entries(requests)]) {
    all[id] = clean(schema) as Json;
  }
  return Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)));
}

/** A schema reference when the schema is a named component (or an array of one); otherwise inline JSON Schema. */
function schemaFor(schema: z.ZodType, io: "input" | "output"): Json {
  const registry = io === "output" ? responseRegistry : requestRegistry;
  const named = registry.get(schema)?.id;
  if (named) return ref(named);
  if (schema instanceof z.ZodArray) {
    const element = schema.element as z.ZodType;
    const elementId = registry.get(element)?.id;
    if (elementId) return { type: "array", items: ref(elementId) };
  }
  return clean(z.toJSONSchema(schema, { io, unrepresentable: "any" })) as Json;
}

function queryParameters(query: z.ZodType): Json[] {
  const json = z.toJSONSchema(query, { io: "input", unrepresentable: "any" }) as {
    properties?: Record<string, Json>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, prop]) => {
    const { description, ...schema } = clean(prop) as Json;
    return {
      name,
      in: "query",
      required: (json.required ?? []).includes(name),
      ...(description ? { description } : {}),
      schema,
    };
  });
}

function operation(name: string, spec: EndpointSpec): Json {
  const pathParams = [...spec.path.matchAll(/:([A-Za-z]+)/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    description: PATH_PARAMS[m[1]!] ?? "",
    schema: { type: "string" },
  }));
  const statuses = Array.isArray(spec.status) ? spec.status : [spec.status ?? 200];
  const responses: Json = {};
  for (const status of statuses) {
    responses[String(status)] =
      status >= 400
        ? { description: "Error", content: { "application/json": { schema: ref("Error") } } }
        : {
            description: "Success",
            content: {
              "application/json": {
                schema: schemaFor(spec.responseByStatus?.[status] ?? spec.response, "output"),
              },
            },
          };
  }
  responses["429"] = { $ref: "#/components/responses/RateLimited" };
  responses.default = {
    description:
      "Error. `error.code` is one of validation_failed, unauthenticated, forbidden, not_found, conflict, invariant_violated, rate_limited, payload_too_large, unavailable (503), internal_error.",
    content: { "application/json": { schema: ref("Error") } },
  };
  const description = [
    spec.description,
    spec.who ? `**Who:** ${spec.who}` : null,
    spec.errors?.length
      ? `**Notable errors:**\n${spec.errors.map((e) => `- \`${e.split(":")[0]}\`:${e.slice(e.indexOf(":") + 1)}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    operationId: name,
    tags: [spec.tag],
    summary: spec.summary,
    "x-rate-limits": ["net.requests", ...spec.limits],
    "x-mutates": spec.mutates,
    ...(description ? { description } : {}),
    ...(spec.auth === "member" ? { security: [{ bearerAuth: [] }, { cookieAuth: [] }] } : { security: [] }),
    parameters: [...pathParams, ...(spec.query ? queryParameters(spec.query) : [])],
    ...(spec.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: schemaFor(spec.body, "input") } },
          },
        }
      : {}),
    responses,
  };
}

export function buildOpenApiDocument(options: { version?: string; serverUrl?: string } = {}): Json {
  const paths: Record<string, Json> = {};
  for (const [name, spec] of Object.entries(ENDPOINTS) as [string, EndpointSpec][]) {
    const path = spec.path.replace(/:([A-Za-z]+)/g, "{$1}");
    paths[path] ??= {};
    paths[path][spec.method.toLowerCase()] = operation(name, spec);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Ideaproxima API",
      version: options.version ?? "1",
      description:
        "A collective repository of humanity's possible futures. Recorded facts are append-only; derived values name the algorithm that produced them.",
    },
    servers: [{ url: options.serverUrl ?? "/" }],
    tags: Object.entries(TAGS).map(([name, description]) => ({ name, description })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Session token from register/login." },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "ip_session",
          description: "HttpOnly session cookie.",
        },
      },
      responses: {
        RateLimited: {
          description: "Request budget exhausted. Wait for Retry-After before retrying.",
          headers: {
            "Retry-After": { required: true, schema: { type: "integer", minimum: 1 } },
            "RateLimit-Policy": { schema: { type: "string" } },
            RateLimit: { schema: { type: "string" } },
          },
          content: { "application/json": { schema: ref("RateLimited") } },
        },
      },
      schemas: componentSchemas(),
    },
  };
}
