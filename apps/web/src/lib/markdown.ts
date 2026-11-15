import { micromark } from "micromark";

/**
 * Markdown → HTML for narrative sections. micromark is CommonMark-compliant and safe by default: raw HTML is
 * escaped and dangerous URL protocols are dropped, so the output can be inserted as HTML.
 *
 * Claim anchors (`[text](claim:<uuid>)`) mark where a claim appears in the prose. They become in-page links
 * carrying the claim id, which the renderer turns into claim markers.
 */
const CLAIM_LINK = /\]\(claim:([0-9a-f-]{36})\)/gi;

export function renderMarkdown(source: string): string {
  return micromark(source.replace(CLAIM_LINK, "](#claim-$1)"));
}
