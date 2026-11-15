// Writes docs/developer/api-reference.md and docs/developer/api/openapi.json from @ideaproxima/contracts.
// Run after changing any request/response schema or the endpoint catalogue: `npm run docs:api`.
// A test fails while they are stale.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API_DOCS_PATHS, renderApiDocs } from "./docs/api-reference";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { openapi, markdown } = renderApiDocs();
mkdirSync(dirname(join(root, API_DOCS_PATHS.openapi)), { recursive: true });
writeFileSync(join(root, API_DOCS_PATHS.openapi), openapi);
writeFileSync(join(root, API_DOCS_PATHS.markdown), markdown);
console.info(`Wrote ${API_DOCS_PATHS.markdown} and ${API_DOCS_PATHS.openapi}`);
