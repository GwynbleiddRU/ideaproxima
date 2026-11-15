import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { IdeaClaimDto } from "@ideaproxima/contracts";
import { CLAIM_ROLE_INFO, CONSEQUENCE_DEPTH_INFO, type ConsequenceDepth } from "@ideaproxima/domain";
import { knowledgeQueries, useUnlinkClaim } from "@/api/knowledge";
import { useAuthGate } from "@/components/auth";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import { MetaLine, PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { RatingMeter } from "@/components/Ratings";
import { ClaimStatusBadge } from "@/components/status";
import { cx } from "@/lib/cx";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { EmptyState, Skeleton } from "@/ui/Feedback";
import { AddEvidenceDialog } from "./AddEvidenceDialog";
import { EvidenceItem } from "./EvidenceItem";
import styles from "./knowledge.module.scss";

/**
 * A claim as it functions in one idea: its derived status, assessments, evidence balance, and — on demand —
 * the evidence itself. Claims are shared: "also underpins N ideas" links to the claim's own page.
 */
export function ClaimCard({
  claim,
  ideaSlug,
  canUnlink,
  defaultOpen,
}: {
  claim: IdeaClaimDto;
  ideaSlug: string;
  canUnlink: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [dialog, setDialog] = useState<"assess" | "evidence" | null>(null);
  const gate = useAuthGate();
  const unlink = useUnlinkClaim(ideaSlug);
  const counts = claim.evidenceCounts;
  const total = (counts.supports ?? 0) + (counts.challenges ?? 0) + (counts.mixed ?? 0);
  const others = claim.ideaCount - 1;

  return (
    <article
      id={`claim-${claim.id}`}
      className={cx(styles.claim, defaultOpen && styles.targeted)}
      data-status={claim.derived.status}
    >
      <header className={styles.claimHead}>
        <ClaimStatusBadge status={claim.derived.status} />
        <Badge tone="outline" title={CLAIM_ROLE_INFO[claim.role].description}>
          {CLAIM_ROLE_INFO[claim.role].label}
          {claim.depth
            ? ` · ${CONSEQUENCE_DEPTH_INFO[claim.depth as ConsequenceDepth]?.label ?? claim.depth}`
            : ""}
        </Badge>
        {claim.hidden && <Badge tone="warning">Hidden</Badge>}
      </header>
      <p className={styles.claimStatement}>{claim.statement}</p>
      <div className={styles.claimMeters}>
        <RatingMeter dimension="support" summary={claim.derived.support} size="sm" accent />
        <RatingMeter dimension="plausibility" summary={claim.derived.plausibility} size="sm" />
      </div>
      <div className={styles.evidenceCounts}>
        <span>
          <b>{counts.supports ?? 0}</b> supporting
        </span>
        <span>
          <b>{counts.challenges ?? 0}</b> challenging
        </span>
        <span>
          <b>{counts.mixed ?? 0}</b> mixed
        </span>
        {others > 0 && (
          <Link to="/claims/$claim" params={{ claim: claim.id }} className={styles.shared}>
            Also underpins {others} other idea{others === 1 ? "" : "s"}
          </Link>
        )}
      </div>
      <footer className={styles.footer}>
        <MetaLine>
          <span>
            Added by <PersonLink person={claim.addedBy} />
          </span>
          <TimeAgo iso={claim.addedAt} />
        </MetaLine>
        <div className={styles.footerActions}>
          <Button
            variant="quiet"
            size="sm"
            icon={<ChevronDown />}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide evidence" : `Evidence (${total})`}
          </Button>
          <Button variant="quiet" size="sm" icon={<Plus />} onClick={() => gate(() => setDialog("evidence"))}>
            Attach evidence
          </Button>
          <Button variant="quiet" size="sm" onClick={() => gate(() => setDialog("assess"))}>
            Assess
          </Button>
          <ButtonLink to="/claims/$claim" params={{ claim: claim.id }} variant="quiet" size="sm">
            Claim page
          </ButtonLink>
          {canUnlink && (
            <Button
              variant="quiet"
              size="sm"
              loading={unlink.isPending}
              onClick={() => unlink.mutate(claim.linkId)}
            >
              Unlink
            </Button>
          )}
          <ModerateButton kind="claim" id={claim.id} hidden={claim.hidden} />
        </div>
      </footer>
      {open && <ClaimEvidence claimId={claim.id} ideaSlug={ideaSlug} />}
      <AddEvidenceDialog
        open={dialog === "evidence"}
        onClose={() => {
          setDialog(null);
          setOpen(true);
        }}
        claimId={claim.id}
        claimStatement={claim.statement}
        ideaSlug={ideaSlug}
      />
      <EvaluateDialog
        open={dialog === "assess"}
        onClose={() => setDialog(null)}
        target={{ kind: "claim", id: claim.id }}
        subject="this claim"
        invalidate={[
          ["idea", ideaSlug],
          ["claim", claim.id],
        ]}
      />
    </article>
  );
}

function ClaimEvidence({ claimId, ideaSlug }: { claimId: string; ideaSlug: string }) {
  const { data, isPending } = useQuery(knowledgeQueries.claim(claimId));
  if (isPending) return <Skeleton lines={3} />;
  const evidence = data?.evidence ?? [];
  return (
    <div className={styles.evidenceList}>
      {evidence.length ? (
        evidence.map((e) => <EvidenceItem key={e.id} evidence={e} ideaSlug={ideaSlug} />)
      ) : (
        <EmptyState compact title="No evidence yet">
          A claim without evidence is a hypothesis. Attach a study, dataset, or a recorded outcome.
        </EmptyState>
      )}
    </div>
  );
}
