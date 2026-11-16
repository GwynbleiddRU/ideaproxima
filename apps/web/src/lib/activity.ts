import type { ActivityDto } from "@ideaproxima/contracts";

type Payload = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Actions that fold when repeated: the detail that must match for two entries to read as one sentence. */
const FOLD: Record<string, (p: Payload) => string> = {
  "stance.taken": (p) => str(p.kind),
  "evaluation.submitted": (p) => str((p.target as Payload | undefined)?.kind),
  "involvement.declared": (p) => `${str(p.capacity)}:${str(p.status)}`,
  "evidence.attached": (p) => str(p.stance),
  "comment.posted": (p) => str(p.kind),
  "claim.linked": (p) => str(p.role),
};

export interface ActivityGroup {
  key: string;
  /** Newest first, as the ledger returns them. */
  entries: ActivityDto[];
}

/**
 * Consecutive entries with the same action on the same idea (and the same detail, e.g. the same stance) become
 * one group: "Ana, Idris and 4 others marked … important". Presentation only — the record is unchanged.
 */
export function foldActivity(entries: ActivityDto[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const e of entries) {
    const detail = FOLD[e.action];
    const key = detail ? `${e.action}|${e.idea?.id ?? ""}|${detail(e.payload)}` : e.id;
    const last = groups.at(-1);
    if (detail && last?.key === key) last.entries.push(e);
    else groups.push({ key, entries: [e] });
  }
  return groups;
}
