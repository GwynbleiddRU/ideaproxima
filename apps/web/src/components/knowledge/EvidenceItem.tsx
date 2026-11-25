import { vocabularyField } from "@/lib/vocabulary";
import { useLocale } from "@/locales/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { EvidenceDto } from "@ideaproxima/contracts";
import { OUTCOME_RESULT_INFO, SOURCE_KIND_INFO } from "@ideaproxima/domain";
import { useWithdrawEvidence } from "@/api/knowledge";
import { useSession } from "@/api/session";
import { useAuthGate } from "@/components/auth";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import { MetaLine, PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { RatingMeter } from "@/components/Ratings";
import { ReasonDialog } from "@/components/ReasonDialog";
import { EvidenceStanceBadge } from "@/components/status";
import { cx } from "@/lib/cx";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import styles from "./knowledge.module.scss";

/**
 * One piece of evidence for a claim: what it shows, what it does NOT establish, where it comes from, and how
 * others assess its quality and relevance. Withdrawn evidence stays visible, struck through, with its reason.
 */
export function EvidenceItem({ evidence, ideaSlug }: { evidence: EvidenceDto; ideaSlug?: string }) {
  useLocale();
  const { me, isModerator } = useSession();
  const gate = useAuthGate();
  const withdraw = useWithdrawEvidence(evidence.claimId, ideaSlug);
  const [dialog, setDialog] = useState<"assess" | "withdraw" | null>(null);
  const withdrawn = !!evidence.withdrawnAt;
  const { source } = evidence;

  return (
    <article className={cx(styles.evidence, withdrawn && styles.withdrawn)} data-stance={evidence.stance}>
      <header className={styles.evidenceHead}>
        <EvidenceStanceBadge stance={evidence.stance} />
        {source && (
          <Badge tone="outline">
            {vocabularyField("sourceKinds", source.kind, "label", SOURCE_KIND_INFO[source.kind].label)}
          </Badge>
        )}
        {evidence.outcome && <Badge tone="outline">Recorded outcome</Badge>}
        {withdrawn && <Badge tone="danger">Withdrawn</Badge>}
        {evidence.hidden && <Badge tone="warning">Hidden</Badge>}
      </header>
      <p className={styles.evidenceSummary}>{evidence.summary}</p>
      {evidence.limitations && (
        <p className={styles.limitations}>
          <strong>Does not establish:</strong> {evidence.limitations}
        </p>
      )}
      {source && (
        <p className={styles.source}>
          <Link to="/sources/$source" params={{ source: source.id }} className="link">
            {source.title}
          </Link>
          {[source.authors, source.venue, source.year].filter(Boolean).length > 0 && (
            <span> · {[source.authors, source.venue, source.year].filter(Boolean).join(", ")}</span>
          )}
          {evidence.locator && <span> · {evidence.locator}</span>}
          {source.doi && (
            <a
              href={`https://doi.org/${source.doi}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={styles.external}
            >
              DOI <ExternalLink size={12} aria-hidden />
            </a>
          )}
          {!source.doi && source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className={styles.external}
            >
              Link <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </p>
      )}
      {evidence.outcome && (
        <p className={styles.source}>
          From an outcome recorded on the platform:{" "}
          {vocabularyField(
            "outcomeResults",
            evidence.outcome.result,
            "label",
            OUTCOME_RESULT_INFO[evidence.outcome.result].label,
          )}
          .
        </p>
      )}
      {withdrawn && evidence.withdrawnReason && (
        <p className={styles.withdrawnReason}>Withdrawn: {evidence.withdrawnReason}</p>
      )}
      <div className={styles.evidenceMeters}>
        <RatingMeter dimension="quality" summary={evidence.derived.quality} size="sm" />
        <RatingMeter dimension="relevance" summary={evidence.derived.relevance} size="sm" />
      </div>
      <footer className={styles.footer}>
        <MetaLine>
          <span>
            <PersonLink person={evidence.contributedBy} />
          </span>
          <TimeAgo iso={evidence.createdAt} />
        </MetaLine>
        <div className={styles.footerActions}>
          {!withdrawn && (
            <Button variant="quiet" size="sm" onClick={() => gate(() => setDialog("assess"))}>
              Assess
            </Button>
          )}
          {!withdrawn && (isModerator || me?.id === evidence.contributedBy.id) && (
            <Button variant="quiet" size="sm" onClick={() => setDialog("withdraw")}>
              Withdraw
            </Button>
          )}
          <ModerateButton kind="evidence" id={evidence.id} hidden={evidence.hidden} />
        </div>
      </footer>
      <EvaluateDialog
        open={dialog === "assess"}
        onClose={() => setDialog(null)}
        target={{ kind: "evidence", id: evidence.id }}
        subject="this evidence"
        invalidate={[["claim", evidence.claimId], ...(ideaSlug ? [["idea", ideaSlug]] : [])]}
      />
      <ReasonDialog
        open={dialog === "withdraw"}
        onClose={() => setDialog(null)}
        title="Withdraw this evidence"
        description="It stays in the record, marked as withdrawn, and stops counting towards the claim's status."
        confirmLabel="Withdraw"
        danger
        onConfirm={(reason) => withdraw.mutateAsync({ evidenceId: evidence.id, reason })}
      />
    </article>
  );
}
