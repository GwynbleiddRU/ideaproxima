/**
 * Verifies every relative link in the repository's Markdown files: the target file or folder must exist, and a
 * `#fragment` must match a heading (GitHub slug rules) or an explicit `<a id="…">` in the target. External links
 * (http, mailto, …) are not fetched. Run by `npm run check`; standalone: `npm run docs:check`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".data",
  ".git",
  "coverage",
  "artifacts",
  "temp-reference-folder",
]);

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : markdownFiles(path);
    return name.endsWith(".md") ? [path] : [];
  });
}

/** Removes fenced code blocks and inline code, where link syntax is only an example. */
const stripCode = (md: string) => md.replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*`/g, "");

/** GitHub-style heading slug (github-slugger semantics: keep letters, numbers, `-`, `_`; spaces → `-`). */
const slug = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\p{M}\- _]/gu, "")
    .replace(/ /g, "-");

const anchorCache = new Map<string, Set<string>>();
function anchorsOf(file: string): Set<string> {
  const cached = anchorCache.get(file);
  if (cached) return cached;
  const md = readFileSync(file, "utf8").replace(/^```[\s\S]*?^```/gm, "");
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const match of md.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(match[1]!.replace(/<a id="[^"]*"><\/a>/g, ""));
    const n = seen.get(base) ?? 0;
    anchors.add(n === 0 ? base : `${base}-${n}`);
    seen.set(base, n + 1);
  }
  for (const match of md.matchAll(/<a id="([^"]+)"/g)) anchors.add(match[1]!);
  anchorCache.set(file, anchors);
  return anchors;
}

const problems: string[] = [];
const files = markdownFiles(root);
let checked = 0;
for (const file of files) {
  const text = stripCode(readFileSync(file, "utf8"));
  for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, https:, mailto:, claim: …
    checked++;
    const [pathPart, fragment] = target.split("#") as [string, string | undefined];
    const resolved = pathPart ? resolve(dirname(file), decodeURIComponent(pathPart)) : file;
    const where = `${relative(root, file)} → ${target}`;
    if (!existsSync(resolved)) {
      problems.push(`${where}: target does not exist`);
      continue;
    }
    if (fragment && resolved.endsWith(".md") && !anchorsOf(resolved).has(fragment)) {
      problems.push(`${where}: no heading or anchor "#${fragment}"`);
    }
  }
}

if (problems.length) {
  console.error(`Broken documentation links (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.info(
  `Documentation links: ${checked} relative links in ${files.length} Markdown files, all resolve.`,
);
