import { vocabularyField } from "@/lib/vocabulary";
import { formatNumber } from "@/lib/format";
import { useMessage } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileQuestion, Plus } from "lucide-react";
import type { IdeaSignals } from "@ideaproxima/contracts";
import { CLAIM_ROLE_INFO, CLAIM_ROLES, CLAIM_STATUSES, type ClaimStatus } from "@ideaproxima/domain";
import { knowledgeQueries } from "@/api/knowledge";
import { useAuthGate } from "@/components/auth";
import { ClaimCard } from "@/components/knowledge/ClaimCard";
import { SectionHeading } from "@/components/PageHeader";
import { claimStatusColor, ClaimStatusBadge } from "@/components/status";
import { Button } from "@/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/ui/Feedback";
import { AddClaimDialog } from "./AddClaimDialog";
import { useIdea, usePermissions } from "./use-idea";
import styles from "./tabs.module.scss";

/**
 * The epistemic core of an idea: the claims it rests on, grouped by the role they play, each with its derived
 * status and the evidence for and against it. Evidence supports claims, not ideas.
 */
export function EvidenceTab() {
  const t = useMessage();
  const idea = useIdea();
  const can = usePermissions(idea);
  const gate = useAuthGate();
  const claims = useQuery(knowledgeQueries.ideaClaims(idea.slug));
  const [adding, setAdding] = useState(false);
  const hash = useLocation({ select: (l) => l.hash });
  const targetId = hash.startsWith("claim-") ? hash.slice("claim-".length) : null;

  // Deep links (from claim markers in the narrative) scroll to their claim once it is rendered.
  useEffect(() => {
    if (targetId && claims.data)
      document.getElementById(`claim-${targetId}`)?.scrollIntoView({ block: "center" });
  }, [targetId, claims.data]);

  return (
    <div className={styles.tab}>
      <SectionHeading
        eyebrow={t("idea.evidence.eyebrow")}
        title={t("idea.tabs.evidence")}
        action={
          <Button variant="primary" size="sm" icon={<Plus />} onClick={() => gate(() => setAdding(true))}>
            {t("idea.evidence.addClaim")}
          </Button>
        }
      />
      {claims.isPending ? (
        <Skeleton lines={8} />
      ) : claims.isError ? (
        <ErrorState error={claims.error} onRetry={() => void claims.refetch()} />
      ) : claims.data.length === 0 ? (
        <EmptyState
          icon={<FileQuestion />}
          title={t("idea.evidence.emptyTitle")}
          action={
            <Button variant="primary" onClick={() => gate(() => setAdding(true))}>
              {t("idea.evidence.firstClaim")}
            </Button>
          }
        >
          {t("idea.evidence.empty")}
        </EmptyState>
      ) : (
        <>
          <ClaimsOverview statuses={claims.data.map((c) => c.derived.status)} counts={idea.signals.counts} />
          {CLAIM_ROLES.map((role) => {
            const group = claims.data
              .filter((c) => c.role === role)
              .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || a.position - b.position);
            if (!group.length) return null;
            return (
              <section key={role} className={styles.group} aria-labelledby={`role-${role}`}>
                <header className={styles.groupHead}>
                  <h3 id={`role-${role}`} className={styles.groupTitle}>
                    {t(`idea.evidence.group.${role}`)} <span>{formatNumber(group.length)}</span>
                  </h3>
                  <p>
                    {vocabularyField("claimRoles", role, "description", CLAIM_ROLE_INFO[role].description)}
                  </p>
                </header>
                <div className={styles.stack}>
                  {group.map((claim) => (
                    <ClaimCard
                      key={claim.linkId}
                      claim={claim}
                      ideaSlug={idea.slug}
                      canUnlink={can.canCurate(claim.addedBy.id)}
                      defaultOpen={claim.id === targetId}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
      <AddClaimDialog open={adding} onClose={() => setAdding(false)} idea={idea} />
    </div>
  );
}

/** The whole claim set at a glance: a stacked bar of derived statuses and the balance of evidence. */
function ClaimsOverview({ statuses, counts }: { statuses: ClaimStatus[]; counts: IdeaSignals["counts"] }) {
  const t = useMessage();
  const byStatus = new Map<ClaimStatus, number>();
  for (const s of statuses) byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  const present = CLAIM_STATUSES.filter((s) => byStatus.has(s));
  return (
    <section className={styles.overview} aria-label={t("idea.evidence.glance")}>
      <div className={styles.stackBar} aria-hidden>
        {present.map((s) => (
          <span key={s} style={{ flexGrow: byStatus.get(s), background: claimStatusColor(s) }} />
        ))}
      </div>
      <div className={styles.overviewRow}>
        <ul className={styles.legend} role="list">
          {present.map((s) => (
            <li key={s}>
              <ClaimStatusBadge status={s} />{" "}
              <span className="tabular">{formatNumber(byStatus.get(s)!)}</span>
            </li>
          ))}
        </ul>
        <p className={styles.muted}>
          {counts.evidence
            ? t("idea.evidence.balance", {
                count: counts.evidence,
                supporting: counts.evidenceSupporting,
                challenging: counts.evidenceChallenging,
              })
            : t("idea.evidence.noEvidence")}
        </p>
      </div>
      <p className={styles.note}>{t("idea.evidence.statusHelp")}</p>
    </section>
  );
}
