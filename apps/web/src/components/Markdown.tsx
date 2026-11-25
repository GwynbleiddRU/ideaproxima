import { vocabularyField } from "@/lib/vocabulary";
import { useLocale } from "@/locales/react";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, type MouseEvent } from "react";
import type { IdeaClaimDto } from "@ideaproxima/contracts";
import { CLAIM_STATUS_INFO } from "@ideaproxima/domain";
import { cx } from "@/lib/cx";
import { renderMarkdown } from "@/lib/markdown";
import { message } from "@/locales/runtime";
import styles from "./Markdown.module.scss";

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Renders narrative Markdown (safe: see lib/markdown). Claim anchors become claim markers coloured by the
 * claim's derived status, labelled for screen readers, and linking to the claim in the Evidence view.
 * External links open safely and are marked as user content.
 */
export function Markdown({
  source,
  claims,
  ideaSlug,
  className,
}: {
  source: string;
  claims?: Map<string, IdeaClaimDto>;
  ideaSlug?: string;
  className?: string;
}) {
  const locale = useLocale();
  const navigate = useNavigate();
  const rendered = useMemo(() => renderMarkdown(source), [source]);
  const html = useMemo(() => {
    const out = rendered.replace(/<a href="#claim-([0-9a-f-]{36})">/gi, (_m, id: string) => {
      const claim = claims?.get(id);
      const status = claim?.derived.status ?? "unassessed";
      const title = claim
        ? message("idea.markdown.claimTitle", {
            status: vocabularyField("claimStatuses", status, "label", CLAIM_STATUS_INFO[status].label),
            statement: claim.statement,
          })
        : message("idea.markdown.claim");
      return `<a href="#claim-${id}" data-claim="${id}" data-status="${status}" title="${escapeAttr(title)}">`;
    });
    return out.replace(
      /<a href="(https?:\/\/[^"]+)">/g,
      '<a href="$1" target="_blank" rel="nofollow ugc noopener noreferrer">',
    );
    // The catalogue and vocabulary helpers read the active locale from the runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, claims, locale]);

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-claim]");
    if (!anchor || !ideaSlug) return;
    event.preventDefault();
    void navigate({
      to: "/ideas/$idea/evidence",
      params: { idea: ideaSlug },
      hash: `claim-${anchor.dataset.claim}`,
    });
  };

  // Safe to inject: the HTML comes from a CommonMark renderer that escapes raw HTML (see lib/markdown).
  return (
    <div
      className={cx(styles.prose, className)}
      dir="auto"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
