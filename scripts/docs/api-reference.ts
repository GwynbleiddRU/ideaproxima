/**
 * Renders the API reference (Markdown) and the OpenAPI document from @ideaproxima/contracts.
 * Pure functions — `scripts/generate-api-docs.ts` writes the files, and a test checks they are up to date.
 */
import {
  ENDPOINTS,
  PATH_PARAMS,
  TAGS,
  buildOpenApiDocument,
  type EndpointSpec,
  type Tag,
} from "@ideaproxima/contracts";

type Schema = {
  $ref?: string;
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  propertyNames?: Schema;
  description?: string;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};

type OpenApi = {
  paths: Record<
    string,
    Record<
      string,
      {
        requestBody?: { content: Record<string, { schema: Schema }> };
        responses: Record<string, { content?: Record<string, { schema: Schema }> }>;
        parameters: { name: string; in: string; required: boolean; description?: string; schema: Schema }[];
      }
    >
  >;
  components: { schemas: Record<string, Schema> };
};

const anchor = (name: string) => `schema-${name.toLowerCase()}`;
const schemaLink = (name: string) => `[\`${name}\`](#${anchor(name)})`;
const refName = (ref: string) => ref.split("/").pop()!;
const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** A compact `{ a: type, b: type }` rendering for small inline objects (map values, array items). */
function inlineShape(s: Schema): string | null {
  const props = Object.entries(s.properties ?? {});
  if (!props.length || props.length > 4) return null;
  return `{ ${props.map(([k, v]) => `${k}: ${typeOf(v)}`).join(", ")} }`;
}

function typeOf(s: Schema | undefined): string {
  if (!s) return "any";
  if (s.$ref) return schemaLink(refName(s.$ref));
  if (s.anyOf || s.oneOf) return (s.anyOf ?? s.oneOf)!.map((x) => typeOf(x)).join(" \\| ");
  if (s.allOf) return s.allOf.map((x) => typeOf(x)).join(" & ");
  if (s.const !== undefined) return `\`${JSON.stringify(s.const)}\``;
  if (s.enum) return s.enum.map((v) => `\`${String(v)}\``).join(" \\| ");
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  if (types.length > 1) return types.map((t) => typeOf({ ...s, type: t })).join(" \\| ");
  switch (types[0]) {
    case "array":
      return `${typeOf(s.items)}[]`;
    case "object": {
      if (s.properties && Object.keys(s.properties).length) return "object";
      if (s.additionalProperties && typeof s.additionalProperties === "object") {
        const keys = s.propertyNames?.enum ? s.propertyNames.enum.map(String).join(" \\| ") : "string";
        const value = s.additionalProperties;
        return `map (${keys} → ${inlineShape(value) ?? typeOf(value)})`;
      }
      return "object";
    }
    case "string":
      return s.format ? `string (${s.format})` : "string";
    case undefined:
      return "any";
    default:
      return types[0]!;
  }
}

function constraints(s: Schema): string {
  const target = s.anyOf?.find((x) => x.type !== "null") ?? s;
  const parts: string[] = [];
  if (target.minLength !== undefined || target.maxLength !== undefined)
    parts.push(`length ${target.minLength ?? 0}–${target.maxLength ?? "∞"}`);
  if (target.minimum !== undefined || target.maximum !== undefined)
    parts.push(`${target.minimum ?? "−∞"}–${target.maximum ?? "∞"}`);
  if (target.minItems !== undefined || target.maxItems !== undefined)
    parts.push(`${target.minItems ?? 0}–${target.maxItems ?? "∞"} items`);
  if (s.default !== undefined) parts.push(`default \`${JSON.stringify(s.default)}\``);
  return parts.join("; ");
}

/** Field rows of an object schema, descending into inline (unnamed) nested objects. */
function fieldRows(s: Schema, prefix = "", depth = 0): string[] {
  const rows: string[] = [];
  const required = new Set(s.required ?? []);
  for (const [name, prop] of Object.entries(s.properties ?? {})) {
    const path = `${prefix}${name}`;
    const nullable = prop.anyOf?.some((x) => x.type === "null");
    const req = required.has(name) ? (nullable ? "yes (nullable)" : "yes") : "no";
    rows.push(
      `| \`${path}\` | ${typeOf(prop)} | ${req} | ${esc([prop.description, constraints(prop)].filter(Boolean).join(" — "))} |`,
    );
    const inner = prop.anyOf?.find((x) => x.type === "object") ?? prop;
    if (depth < 2 && !inner.$ref && inner.type === "object" && inner.properties) {
      rows.push(...fieldRows(inner, `${path}.`, depth + 1));
    }
    if (depth < 2 && inner.type === "array" && inner.items?.type === "object" && inner.items.properties) {
      rows.push(...fieldRows(inner.items, `${path}[].`, depth + 1));
    }
  }
  return rows;
}

function fieldsTable(s: Schema): string {
  const rows = fieldRows(s);
  if (!rows.length) return `Type: ${typeOf(s)}\n`;
  return ["| Field | Type | Required | Notes |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
}

function endpointSection(name: string, spec: EndpointSpec, doc: OpenApi): string {
  const op = doc.paths[spec.path.replace(/:([A-Za-z]+)/g, "{$1}")]![spec.method.toLowerCase()]!;
  const out: string[] = [];
  out.push(`### \`${spec.method} ${spec.path}\``, "", `**${spec.summary}** · \`${name}\``, "");
  out.push(
    `**Access:** ${spec.auth === "public" ? "public" : "signed in"}${spec.who ? ` — ${spec.who}` : ""}`,
    "",
  );
  out.push(
    `**Rate limits:** ${["net.requests", ...spec.limits].map((policy) => `\`${policy}\``).join(", ")}`,
    "",
  );
  if (spec.description) out.push(spec.description, "");
  const pathParams = op.parameters.filter((p) => p.in === "path");
  const queryParams = op.parameters.filter((p) => p.in === "query");
  if (pathParams.length) {
    out.push("Path parameters:", "", "| Name | Description |", "| --- | --- |");
    for (const p of pathParams) out.push(`| \`${p.name}\` | ${esc(PATH_PARAMS[p.name] ?? "")} |`);
    out.push("");
  }
  if (queryParams.length) {
    out.push("Query parameters:", "", "| Name | Type | Required | Notes |", "| --- | --- | --- | --- |");
    for (const p of queryParams) {
      out.push(
        `| \`${p.name}\` | ${typeOf(p.schema)} | ${p.required ? "yes" : "no"} | ${esc([p.description, constraints(p.schema)].filter(Boolean).join(" — "))} |`,
      );
    }
    out.push("");
  }
  const body = op.requestBody?.content["application/json"]?.schema;
  if (body) out.push(`Request body: ${typeOf(body)}`, "");
  const statuses = Array.isArray(spec.status) ? spec.status : [spec.status ?? 200];
  for (const status of statuses) {
    const schema = op.responses[String(status)]?.content?.["application/json"]?.schema;
    out.push(`Response \`${status}\`: ${status >= 400 ? schemaLink("Error") : typeOf(schema)}`, "");
  }
  if (spec.errors?.length) {
    out.push("Notable errors:", "");
    for (const e of spec.errors) {
      const i = e.indexOf(":");
      out.push(`- \`${e.slice(0, i)}\` —${e.slice(i + 1)}`);
    }
    out.push("");
  }
  return out.join("\n");
}

/** Where the generated files live, relative to the repository root. */
export const API_DOCS_PATHS = {
  markdown: "docs/developer/api-reference.md",
  openapi: "docs/developer/api/openapi.json",
} as const;

export function renderApiDocs(): { openapi: string; markdown: string } {
  const doc = buildOpenApiDocument() as unknown as OpenApi;
  const endpoints = Object.entries(ENDPOINTS) as [string, EndpointSpec][];
  const md: string[] = [
    "# API reference",
    "",
    "<!-- Generated from packages/contracts by `npm run docs:api`. Do not edit by hand. -->",
    "",
    "Every endpoint, request and response of the Ideaproxima API, generated from the same schemas the server",
    "validates against and the test suite checks every response with. The machine-readable form is",
    "[`api/openapi.json`](api/openapi.json) (also served live at `GET /v1/openapi.json`). Conventions —",
    "authentication, errors, pagination, idempotency — are explained in the [developer guide](developer-guide.md#api-conventions).",
    "",
    `**${endpoints.length} endpoints.** Access “signed in” means a session (Bearer token or \`ip_session\` cookie) is required; further restrictions are listed per endpoint.`,
    "",
    `Every endpoint can answer 429 with ${schemaLink("RateLimited")} and a \`Retry-After\` delay in seconds.`,
    "",
    "## Contents",
    "",
  ];
  for (const tag of Object.keys(TAGS) as Tag[]) {
    md.push(`- [${tag}](#${tag.toLowerCase()}) — ${TAGS[tag]}`);
    for (const [name, spec] of endpoints.filter(([, s]) => s.tag === tag)) {
      md.push(`  - \`${spec.method} ${spec.path}\` — ${spec.summary} (\`${name}\`)`);
    }
  }
  md.push("- [Schemas](#schemas)", "");
  for (const tag of Object.keys(TAGS) as Tag[]) {
    md.push(`## ${tag}`, "", TAGS[tag], "");
    for (const [name, spec] of endpoints.filter(([, s]) => s.tag === tag))
      md.push(endpointSection(name, spec, doc));
  }
  md.push(
    "## Schemas",
    "",
    "Named request and response shapes. Nested inline objects are listed with dotted paths.",
    "",
  );
  for (const [name, schema] of Object.entries(doc.components.schemas)) {
    md.push(`### <a id="${anchor(name)}"></a>${name}`, "");
    if (schema.description) md.push(schema.description, "");
    md.push(fieldsTable(schema));
  }
  return {
    openapi: JSON.stringify(doc, null, 2) + "\n",
    markdown: md.join("\n").replace(/\n{3,}/g, "\n\n") + "\n",
  };
}
