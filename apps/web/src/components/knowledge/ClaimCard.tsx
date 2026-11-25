import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { ArrowUpRight, ChevronDown, Gauge, Link2, Paperclip } from "lucide-react";
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
  const t = useMessage();
  const [open, setOpen] = useState(!!defaultOpen);
  const [dialog, setDialog] = useState<"assess" | "evidence" | null>(null);
  const gate = useAuthGate();
  const unlink = useUnlinkClaim(ideaSlug);
  const counts = claim.evidenceCounts;
  const total = (counts.supports ?? 0) + (counts.challenges ?? 0) + (counts.mixed ?? 0);
  const others = claim.ideaCount - 1;

  const balance = (
    [
      ["supports", "idea.claim.supporting", "var(--status-established)"],
      ["challenges", "idea.claim.challenging", "var(--status-refuted)"],
      ["mixed", "idea.claim.mixed", "var(--status-hypothesis)"],
    ] as const
  ).filter(([key]) => (counts[key] ?? 0) > 0);

  return (
    <article
      id={`claim-${claim.id}`}
      className={cx(styles.claim, defaultOpen && styles.targeted)}
      data-status={claim.derived.status}
    >
      <header className={styles.claimHead}>
        <ClaimStatusBadge status={claim.derived.status} />
        <Badge
          tone="outline"
          title={vocabularyField(
            "claimRoles",
            claim.role,
            "description",
            CLAIM_ROLE_INFO[claim.role].description,
          )}
        >
          {vocabularyField("claimRoles", claim.role, "label", CLAIM_ROLE_INFO[claim.role].label)}
          {claim.depth
            ? ` · ${vocabularyField("consequenceDepths", claim.depth as ConsequenceDepth, "label", CONSEQUENCE_DEPTH_INFO[claim.depth as ConsequenceDepth]?.label) ?? claim.depth}`
            : ""}
        </Badge>
        {others > 0 && (
          <Link to="/claims/$claim" params={{ claim: claim.id }} className={styles.shared}>
            <Link2 aria-hidden /> {t("idea.claim.alsoUnderpins", { count: others })}
          </Link>
        )}
        {claim.hidden && <Badge tone="warning">{t("common.hidden")}</Badge>}
      </header>
      <p className={styles.claimStatement} dir="auto">
        {claim.statement}
      </p>
      <div className={styles.claimMeters}>
        <RatingMeter dimension="support" summary={claim.derived.support} size="sm" accent />
        <RatingMeter dimension="plausibility" summary={claim.derived.plausibility} size="sm" />
      </div>
      {balance.length > 0 && (
        <p className={styles.balance}>
          {balance.map(([key, label, color]) => (
            <span key={key} style={{ "--dot": color } as CSSProperties}>
              {t(label, { count: counts[key] })}
            </span>
          ))}
        </p>
      )}
      <footer className={styles.footer}>
        <div className={styles.footerActions}>
          {total > 0 && (
            <Button
              variant="quiet"
              size="sm"
              icon={<ChevronDown className={cx(styles.chevron, open && styles.chevronOpen)} />}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {t("idea.claim.evidenceCount", { count: total })}
            </Button>
          )}
          <Button
            variant="quiet"
            size="sm"
            icon={<Paperclip />}
            onClick={() => gate(() => setDialog("evidence"))}
          >
            {t("idea.claim.attach")}
          </Button>
          <Button variant="quiet" size="sm" icon={<Gauge />} onClick={() => gate(() => setDialog("assess"))}>
            {t("common.assess")}
          </Button>
          <ButtonLink to="/claims/$claim" params={{ claim: claim.id }} variant="quiet" size="sm">
            <ArrowUpRight aria-hidden /> {t("idea.claim.open")}
          </ButtonLink>
          {canUnlink && (
            <Button
              variant="quiet"
              size="sm"
              retryError={unlink.error}
              loading={unlink.isPending}
              onClick={() => unlink.mutate(claim.linkId)}
            >
              {t("idea.claim.unlink")}
            </Button>
          )}
          <ModerateButton kind="claim" id={claim.id} hidden={claim.hidden} />
        </div>
        <MetaLine className={styles.addedBy}>
          <span>
            <LocalizedText
              id="idea.claim.addedBy"
              components={{ 0: <PersonLink person={claim.addedBy} /> }}
            />
          </span>
          <TimeAgo iso={claim.addedAt} />
        </MetaLine>
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
        subject={t("idea.claim.subject")}
        invalidate={[
          ["idea", ideaSlug],
          ["claim", claim.id],
        ]}
      />
    </article>
  );
}

function ClaimEvidence({ claimId, ideaSlug }: { claimId: string; ideaSlug: string }) {
  const t = useMessage();
  const { data, isPending } = useQuery(knowledgeQueries.claim(claimId));
  if (isPending) return <Skeleton lines={3} />;
  const evidence = data?.evidence ?? [];
  return (
    <div className={styles.evidenceList}>
      {evidence.length ? (
        evidence.map((e) => <EvidenceItem key={e.id} evidence={e} ideaSlug={ideaSlug} />)
      ) : (
        <EmptyState compact title={t("idea.claim.noEvidence")}>
          {t("idea.claim.evidenceInvite")}
        </EmptyState>
      )}
    </div>
  );
}
