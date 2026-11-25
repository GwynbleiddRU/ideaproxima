import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquarePlus, Plus, Scale } from "lucide-react";
import { CLAIM_ROLE_INFO, CLAIM_STATUS_INFO } from "@ideaproxima/domain";
import { keys } from "@/api/keys";
import { knowledgeQueries } from "@/api/knowledge";
import { useAuthGate } from "@/components/auth";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import { AddEvidenceDialog } from "@/components/knowledge/AddEvidenceDialog";
import { ArgumentCard, ArgumentComposer } from "@/components/knowledge/Arguments";
import { EvidenceItem } from "@/components/knowledge/EvidenceItem";
import { MetaLine, PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { SectionHeading } from "@/components/PageHeader";
import { RatingMeter } from "@/components/Ratings";
import { StageBadge } from "@/components/Stage";
import { ClaimStatusBadge } from "@/components/status";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/Feedback";
import styles from "./knowledge-page.module.scss";

const route = getRouteApi("/claims/$claim");

/** One claim across every idea that rests on it, with all its evidence and arguments. */
export function ClaimPage() {
  const t = useMessage();
  const { claim: id } = route.useParams();
  const claim = useSuspenseQuery(knowledgeQueries.claim(id)).data;
  const gate = useAuthGate();
  const [dialog, setDialog] = useState<"evidence" | "assess" | "argue" | null>(null);
  const invalidate = [keys.claim(claim.id)];

  return (
    <div className="container">
      <title>
        {t("common.pageTitle", { title: t("claimPage.title", { claim: claim.statement.slice(0, 60) }) })}
      </title>
      <header className={styles.header}>
        <p className="eyebrow">{t("claimPage.claim")}</p>
        <div className={styles.badges}>
          <ClaimStatusBadge status={claim.derived.status} />
          {claim.hidden && <Badge tone="warning">{t("common.hidden")}</Badge>}
        </div>
        <h1 className={styles.statement}>{claim.statement}</h1>
        <p className={styles.explain}>
          {vocabularyField(
            "claimStatuses",
            claim.derived.status,
            "description",
            CLAIM_STATUS_INFO[claim.derived.status].description,
          )}
        </p>
        <MetaLine>
          <span>
            <LocalizedText
              id="claimPage.statedByPerson"
              components={{ 0: <PersonLink person={claim.createdBy} /> }}
            />
          </span>
          <TimeAgo iso={claim.createdAt} />
          <span>{t("claimPage.underpinsCount", { count: claim.ideaCount })}</span>
        </MetaLine>
        <div className={styles.meters}>
          <RatingMeter dimension="support" summary={claim.derived.support} accent />
          <RatingMeter dimension="plausibility" summary={claim.derived.plausibility} />
        </div>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus />}
            onClick={() => gate(() => setDialog("evidence"))}
          >
            {t("idea.claim.attach")}
          </Button>
          <Button size="sm" icon={<Scale />} onClick={() => gate(() => setDialog("assess"))}>
            {t("common.assess")}
          </Button>
          <Button size="sm" icon={<MessageSquarePlus />} onClick={() => gate(() => setDialog("argue"))}>
            {t("claimPage.argue")}
          </Button>
          <ModerateButton kind="claim" id={claim.id} hidden={claim.hidden} />
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section>
            <SectionHeading
              eyebrow={t("claimPage.forAndAgainst")}
              title={t("common.countLabel", { label: t("claimPage.evidence"), count: claim.evidence.length })}
            />
            {claim.evidence.length ? (
              <div className={styles.stack}>
                {claim.evidence.map((e) => (
                  <EvidenceItem key={e.id} evidence={e} />
                ))}
              </div>
            ) : (
              <EmptyState compact title={t("idea.claim.noEvidence")}>
                {t("claimPage.noEvidenceHelp")}
              </EmptyState>
            )}
          </section>
          <section>
            <SectionHeading
              eyebrow={t("claimPage.reasoning")}
              title={t("common.countLabel", {
                label: t("claimPage.arguments"),
                count: claim.arguments.length,
              })}
            />
            {dialog === "argue" && (
              <div className={styles.panel}>
                <ArgumentComposer
                  target={{ kind: "claim", id: claim.id }}
                  invalidate={invalidate}
                  onDone={() => setDialog(null)}
                />
              </div>
            )}
            <div className={styles.stack}>
              {claim.arguments.map((a) => (
                <ArgumentCard key={a.id} argument={a} invalidate={invalidate} />
              ))}
            </div>
          </section>
        </div>
        <aside className={styles.side}>
          <SectionHeading eyebrow={t("claimPage.sharedKnowledge")} title={t("claimPage.ideasRestingOnIt")} />
          <ul className={styles.ideas} role="list">
            {claim.ideas.map((idea) => (
              <li key={idea.id}>
                <Link
                  to="/ideas/$idea/evidence"
                  params={{ idea: idea.slug }}
                  hash={`claim-${claim.id}`}
                  className={styles.idea}
                >
                  {idea.title}
                </Link>
                <span className={styles.ideaMeta}>
                  <Badge tone="outline">
                    {vocabularyField("claimRoles", idea.role, "label", CLAIM_ROLE_INFO[idea.role].label)}
                  </Badge>
                  <StageBadge stage={idea.stage} />
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <AddEvidenceDialog
        open={dialog === "evidence"}
        onClose={() => setDialog(null)}
        claimId={claim.id}
        claimStatement={claim.statement}
      />
      <EvaluateDialog
        open={dialog === "assess"}
        onClose={() => setDialog(null)}
        target={{ kind: "claim", id: claim.id }}
        subject={t("idea.claim.subject")}
        invalidate={invalidate}
      />
    </div>
  );
}
