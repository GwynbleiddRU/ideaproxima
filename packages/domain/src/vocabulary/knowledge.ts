import type { Term } from "./term";

/**
 * IDEA SECTIONS — the readable narrative of an idea, stored inside immutable revisions.
 *
 * Narrative and structure coexist on purpose:
 *  - sections are prose for humans to read (progressive disclosure on the idea page);
 *  - claims, evidence, arguments and relations are the atomised, independently-evaluable structure.
 * Prose can point at structured claims with claim anchors (see `parseClaimAnchors`).
 *
 * Adding a section is a vocabulary change only — revision content is JSON, so no migration is needed.
 */
export const IDEA_SECTIONS = [
  "overview",
  "motivation",
  "mechanism",
  "prerequisites",
  "uncertainties",
  "challenges",
  "consequences",
  "origins",
] as const;
export type IdeaSectionKey = (typeof IDEA_SECTIONS)[number];

export const IDEA_SECTION_INFO: Record<IdeaSectionKey, Term & { prompt: string }> = {
  overview: {
    label: "The idea",
    description: "What exactly is proposed.",
    prompt: "What possibility do you want humanity to remember?",
  },
  motivation: {
    label: "Why it could matter",
    description: "The problem, limit or opportunity it addresses.",
    prompt: "What would this make possible?",
  },
  mechanism: {
    label: "How it might work",
    description: "The proposed mechanism or approach.",
    prompt: "How might it work?",
  },
  prerequisites: {
    label: "What would need to exist first",
    description: "Technologies, resources, knowledge or social conditions it depends on.",
    prompt: "What would need to exist first?",
  },
  uncertainties: {
    label: "What we don't know",
    description: "Open questions and how one might find out.",
    prompt: "What is still unknown?",
  },
  challenges: {
    label: "Challenges & counterarguments",
    description: "Risks, objections and the strongest case against.",
    prompt: "What could go wrong?",
  },
  consequences: {
    label: "What it could enable",
    description: "Immediate and long-range consequences, intended or not.",
    prompt: "What could it lead to?",
  },
  origins: {
    label: "Origins & prior art",
    description:
      "Where the idea comes from. The person who submits an idea is not necessarily its originator — credit them here.",
    prompt: "Do you know of related research or earlier proposals?",
  },
};

/**
 * CLAIM ROLES — how a claim functions *within a particular idea*.
 * Claims themselves are idea-independent (one claim can underpin many ideas); the role lives on the link.
 */
export const CLAIM_ROLES = ["premise", "mechanism", "prerequisite", "consequence", "risk"] as const;
export type ClaimRole = (typeof CLAIM_ROLES)[number];

export const CLAIM_ROLE_INFO: Record<ClaimRole, Term> = {
  premise: { label: "Premise", description: "Something the idea assumes to be true." },
  mechanism: { label: "Mechanism", description: "A step in how the idea would work." },
  prerequisite: { label: "Prerequisite", description: "Something that must exist or be possible first." },
  consequence: {
    label: "Consequence",
    description: "Something that would follow if the idea were realised.",
  },
  risk: { label: "Risk", description: "A possible harmful or unwanted consequence." },
};

/** Consequence depth for the consequence tree (only meaningful for role = consequence | risk). */
export const CONSEQUENCE_DEPTHS = [1, 2, 3, 4] as const;
export type ConsequenceDepth = (typeof CONSEQUENCE_DEPTHS)[number];
export const CONSEQUENCE_DEPTH_INFO: Record<ConsequenceDepth, Term> = {
  1: { label: "Immediate", description: "Direct, first-order effects." },
  2: { label: "Second-order", description: "Effects of the effects." },
  3: { label: "New capability", description: "What humanity could newly do." },
  4: { label: "Civilizational", description: "Potential long-range, civilization-level effects." },
};

/**
 * DERIVED CLAIM STATUS — never stored, always computed from assessments (see metrics/baseline.ts).
 * "Contested" can only be derived: it *means* that independent assessments disagree.
 */
export const CLAIM_STATUSES = [
  "unassessed",
  "established",
  "supported",
  "hypothesis",
  "unknown",
  "doubtful",
  "refuted",
  "contested",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_INFO: Record<ClaimStatus, Term> = {
  unassessed: { label: "Unassessed", description: "Nobody has assessed this claim yet." },
  established: {
    label: "Established",
    description: "Broad consensus; replicated across independent sources.",
  },
  supported: { label: "Supported", description: "Backed by credible evidence, but not settled." },
  hypothesis: {
    label: "Hypothesis",
    description: "A reasoned proposal that has not yet been tested in this context.",
  },
  unknown: { label: "Unknown", description: "No one currently knows. Marked so the gap stays visible." },
  doubtful: { label: "Doubtful", description: "Assessors lean against it, without decisive evidence." },
  refuted: {
    label: "Refuted",
    description: "Contradicted by evidence. Preserved, because failures are knowledge.",
  },
  contested: { label: "Contested", description: "Assessors actively disagree." },
};

/** Evidence stance relative to the claim it is attached to. */
export const EVIDENCE_STANCES = ["supports", "challenges", "mixed"] as const;
export type EvidenceStance = (typeof EVIDENCE_STANCES)[number];

export const EVIDENCE_STANCE_INFO: Record<EvidenceStance, Term> = {
  supports: { label: "Supports", description: "Makes the claim more likely to be true." },
  challenges: { label: "Challenges", description: "Makes the claim less likely to be true." },
  mixed: { label: "Mixed", description: "Supports some aspects and challenges others." },
};

/** Kinds of source a piece of evidence can cite. Sources are deduplicated by DOI / URL. */
export const SOURCE_KINDS = [
  "peer_reviewed_article",
  "preprint",
  "book",
  "report",
  "dataset",
  "patent",
  "standard",
  "thesis",
  "web_page",
  "news",
  "expert_statement",
  "other",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_KIND_INFO: Record<SourceKind, Term> = {
  peer_reviewed_article: { label: "Peer-reviewed article", description: "Published after peer review." },
  preprint: { label: "Preprint", description: "Publicly posted research not (yet) peer-reviewed." },
  book: { label: "Book", description: "Monograph or edited volume." },
  report: { label: "Report", description: "Institutional, governmental or technical report." },
  dataset: { label: "Dataset", description: "Published data." },
  patent: { label: "Patent", description: "Patent or patent application." },
  standard: { label: "Standard", description: "Technical or regulatory standard." },
  thesis: { label: "Thesis", description: "Doctoral or master's thesis." },
  web_page: { label: "Web page", description: "General web resource." },
  news: { label: "News", description: "Journalism." },
  expert_statement: { label: "Expert statement", description: "Statement by a recognised expert." },
  other: { label: "Other", description: "Anything else." },
};

/** Argument stance relative to its target (an idea, a claim, or another argument). */
export const ARGUMENT_STANCES = ["supports", "opposes", "qualifies"] as const;
export type ArgumentStance = (typeof ARGUMENT_STANCES)[number];

export const ARGUMENT_STANCE_INFO: Record<ArgumentStance, Term> = {
  supports: { label: "Supports", description: "Reasons in favour." },
  opposes: { label: "Opposes", description: "Counterargument, critique or rebuttal." },
  qualifies: { label: "Qualifies", description: "Accepts the target with conditions or caveats." },
};

/** Lightweight discussion. Epistemically meaningful content belongs in claims, evidence and arguments. */
export const COMMENT_KINDS = ["comment", "question", "suggestion"] as const;
export type CommentKind = (typeof COMMENT_KINDS)[number];
