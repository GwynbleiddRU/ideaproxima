import { Check, Circle } from "lucide-react";
import type { IdeaDetail } from "@ideaproxima/contracts";
import { IDEA_STAGE_INFO, IDEA_STAGES, stageOrdinal, type IdeaStage } from "@ideaproxima/domain";
import { cx } from "@/lib/cx";
import { Badge } from "@/ui/Badge";
import styles from "./Stage.module.scss";

/** The lifecycle stage: what has been *done* with an idea (not what is known about it). */
export function StageBadge({ stage }: { stage: IdeaStage }) {
  const info = IDEA_STAGE_INFO[stage];
  return (
    <Badge tone="outline" title={info.description} className={styles.badge}>
      <span className={styles.pips} aria-hidden>
        {IDEA_STAGES.map((s) => (
          <span key={s} className={cx(styles.pip, stageOrdinal(s) <= stageOrdinal(stage) && styles.pipOn)} />
        ))}
      </span>
      {info.label}
    </Badge>
  );
}

/**
 * The six lifecycle stages, the current one marked, and for each stage whether its requirement is met (from
 * the API's `stageRequirements`). Stages are not strictly sequential; the track shows order, not a gate.
 */
export function StageTrack({ idea }: { idea: Pick<IdeaDetail, "stage" | "stageRequirements"> }) {
  const current = stageOrdinal(idea.stage);
  const requirement = new Map(idea.stageRequirements.map((r) => [r.stage, r]));
  return (
    <ol className={styles.track} role="list">
      {IDEA_STAGES.map((stage, i) => {
        const req = requirement.get(stage);
        const state = i < current ? "past" : i === current ? "current" : "future";
        return (
          <li
            key={stage}
            className={cx(styles.step, styles[state])}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className={styles.marker} aria-hidden>
              {state === "past" ? <Check size={12} /> : <Circle size={8} fill="currentColor" />}
            </span>
            <span className={styles.stepBody}>
              <span className={styles.stepLabel}>{IDEA_STAGE_INFO[stage].label}</span>
              {state === "future" && req && (
                <span className={cx(styles.requirement, req.met && styles.met)}>
                  {req.met ? "Requirement met" : req.requirement}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
