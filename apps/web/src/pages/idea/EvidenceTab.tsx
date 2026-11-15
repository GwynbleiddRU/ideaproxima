import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileQuestion, Plus } from "lucide-react";
import { CLAIM_ROLE_INFO, CLAIM_ROLES } from "@ideaproxima/domain";
import { knowledgeQueries } from "@/api/knowledge";
import { useAuthGate } from "@/components/auth";
import { ClaimCard } from "@/components/knowledge/ClaimCard";
import { SectionHeading } from "@/components/PageHeader";
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
        eyebrow="What the idea rests on"
        title="Claims & evidence"
        action={
          <Button variant="primary" size="sm" icon={<Plus />} onClick={() => gate(() => setAdding(true))}>
            Add a claim
          </Button>
        }
      />
      <p className={styles.lede}>
        Each claim's status is derived from independent assessments, never typed in. Evidence is attached to
        claims, with what it shows and what it does not establish. A claim can underpin several ideas;
        evidence added in one place counts everywhere.
      </p>
      {claims.isPending ? (
        <Skeleton lines={8} />
      ) : claims.isError ? (
        <ErrorState error={claims.error} onRetry={() => void claims.refetch()} />
      ) : claims.data.length === 0 ? (
        <EmptyState
          icon={<FileQuestion />}
          title="No claims yet"
          action={
            <Button variant="primary" onClick={() => gate(() => setAdding(true))}>
              State the first claim
            </Button>
          }
        >
          Break the idea into the premises, mechanisms and prerequisites it depends on. That is what makes it
          examinable.
        </EmptyState>
      ) : (
        CLAIM_ROLES.map((role) => {
          const group = claims.data
            .filter((c) => c.role === role)
            .sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || a.position - b.position);
          if (!group.length) return null;
          return (
            <section key={role} className={styles.group} aria-labelledby={`role-${role}`}>
              <header className={styles.groupHead}>
                <h3 id={`role-${role}`} className={styles.groupTitle}>
                  {CLAIM_ROLE_INFO[role].label}s <span>{group.length}</span>
                </h3>
                <p>{CLAIM_ROLE_INFO[role].description}</p>
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
        })
      )}
      <AddClaimDialog open={adding} onClose={() => setAdding(false)} idea={idea} />
    </div>
  );
}
