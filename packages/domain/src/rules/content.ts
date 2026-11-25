import { DomainError } from "../errors";
import type { ErrorParams, ErrorReason } from "../errors.en";
import { IDEA_SECTIONS, type IdeaSectionKey } from "../vocabulary/knowledge";

/** Single source of truth for content limits; the API contracts import these. */
export const LIMITS = {
  ideaTitle: { min: 5, max: 160 },
  ideaSummary: { min: 20, max: 600 },
  section: { max: 20_000 },
  topicsPerIdea: { min: 1, max: 4 },
  tagsPerIdea: { max: 12 },
  tag: { max: 40 },
  changeNote: { max: 500 },
  claimStatement: { min: 10, max: 600 },
  rationale: { max: 4_000 },
  argumentTitle: { min: 5, max: 200 },
  argumentBody: { min: 20, max: 10_000 },
  evidenceSummary: { min: 10, max: 2_000 },
  commentBody: { min: 2, max: 10_000 },
  handle: { min: 3, max: 32 },
  displayName: { min: 2, max: 80 },
  bio: { max: 2_000 },
  password: { min: 10, max: 200 },
} as const;

/**
 * The content of an idea at one point in time. Stored verbatim as the JSON body of an immutable revision.
 * `topics` are topic slugs; the API resolves them to ids when projecting the current revision.
 */
export interface IdeaContent {
  title: string;
  summary: string;
  sections: Partial<Record<IdeaSectionKey, string>>;
  topics: string[];
  tags: string[];
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ").slice(0, LIMITS.tag.max);
}

/** Trims, drops empty sections, lowercases and de-duplicates tags/topics. Pure and idempotent. */
export function normalizeIdeaContent(input: IdeaContent): IdeaContent {
  const sections: Partial<Record<IdeaSectionKey, string>> = {};
  for (const key of IDEA_SECTIONS) {
    const text = input.sections[key]?.trim();
    if (text) sections[key] = text;
  }
  const tags = [...new Set(input.tags.map(normalizeTag).filter(Boolean))];
  const topics = [...new Set(input.topics.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const content: IdeaContent = {
    title: input.title.trim(),
    summary: input.summary.trim(),
    sections,
    topics,
    tags,
  };
  assertIdeaContent(content);
  return content;
}

export function assertIdeaContent(c: IdeaContent): void {
  const fail = (reason: ErrorReason, params: ErrorParams) => {
    throw new DomainError("validation_failed", reason, params);
  };
  if (c.title.length < LIMITS.ideaTitle.min || c.title.length > LIMITS.ideaTitle.max)
    fail("idea_title_length", LIMITS.ideaTitle);
  if (c.summary.length < LIMITS.ideaSummary.min || c.summary.length > LIMITS.ideaSummary.max)
    fail("idea_summary_length", LIMITS.ideaSummary);
  if (c.topics.length < LIMITS.topicsPerIdea.min || c.topics.length > LIMITS.topicsPerIdea.max)
    fail("idea_topic_count", LIMITS.topicsPerIdea);
  if (c.tags.length > LIMITS.tagsPerIdea.max) fail("idea_tag_count", { max: LIMITS.tagsPerIdea.max });
  for (const [key, text] of Object.entries(c.sections)) {
    if (!(IDEA_SECTIONS as readonly string[]).includes(key)) fail("unknown_idea_section", { section: key });
    if ((text ?? "").length > LIMITS.section.max) fail("idea_section_too_long", { section: key });
  }
}

/** Two contents are equal when a new revision would change nothing. Prevents empty revisions in history. */
export function sameIdeaContent(a: IdeaContent, b: IdeaContent): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
const canonical = (c: IdeaContent) => ({
  title: c.title,
  summary: c.summary,
  sections: Object.fromEntries(IDEA_SECTIONS.filter((k) => c.sections[k]).map((k) => [k, c.sections[k]])),
  topics: [...c.topics].sort(),
  tags: [...c.tags].sort(),
});

/** URL slug derived from a title. Uniqueness is the caller's job (append a suffix on collision). */
export function slugify(text: string, maxLength = 80): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "idea";
}

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export function isValidHandle(handle: string): boolean {
  return (
    handle.length >= LIMITS.handle.min &&
    handle.length <= LIMITS.handle.max &&
    HANDLE_RE.test(handle) &&
    !handle.includes("--")
  );
}

/**
 * DOIs are case-insensitive; store them lowercased without resolver prefixes so that the same publication
 * submitted twice resolves to one Source.
 */
export function normalizeDoi(raw: string): string | null {
  const doi = raw
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null;
}

/**
 * CLAIM ANCHORS — the convention for pointing from narrative prose to structured claims ("claim layers" in
 * the design). It is a plain Markdown link with a `claim:` scheme, so it degrades gracefully in any renderer:
 *
 *     Swarms could [recognise contaminant molecules](claim:0190f5c2-...) and bind them.
 */
const CLAIM_ANCHOR_RE =
  /\[([^\]\n]+)\]\(claim:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export interface ClaimAnchor {
  text: string;
  claimId: string;
  index: number;
}

export function parseClaimAnchors(markdown: string): ClaimAnchor[] {
  return [...markdown.matchAll(CLAIM_ANCHOR_RE)].map((m) => ({
    text: m[1]!,
    claimId: m[2]!.toLowerCase(),
    index: m.index ?? 0,
  }));
}

export function claimAnchorsIn(content: IdeaContent): string[] {
  const ids = new Set<string>();
  for (const text of Object.values(content.sections))
    for (const a of parseClaimAnchors(text ?? "")) ids.add(a.claimId);
  return [...ids];
}
