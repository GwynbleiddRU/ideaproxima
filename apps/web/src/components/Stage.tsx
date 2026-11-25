import { CircleCheck, Flag } from "lucide-react";
import type { IdeaDetail } from "@ideaproxima/contracts";
import { IDEA_STAGES, stageOrdinal, type IdeaStage } from "@ideaproxima/domain";
import { cx } from "@/lib/cx";
import { formatList } from "@/lib/format";
import { useVocabulary } from "@/lib/vocabulary";
import { Badge } from "@/ui/Badge";
import styles from "./Stage.module.scss";

/** The lifecycle stage: what has been *done* with an idea (not what is known about it). */
export function StageBadge({ stage }: { stage: IdeaStage }) {
  const vocabulary = useVocabulary();
  const info = vocabulary.stage(stage);
  return (
    <Badge tone="outline" title={info.description} className={styles.badge}>
      <Pips stage={stage} />
      {info.label}
    </Badge>
  );
}

function Pips({ stage }: { stage: IdeaStage }) {
  return (
    <span className={styles.pips} aria-hidden>
      {IDEA_STAGES.map((s) => (
        <span key={s} className={cx(styles.pip, stageOrdinal(s) <= stageOrdinal(stage) && styles.pipOn)} />
      ))}
    </span>
  );
}

/**
 * Where an idea is on the six-stage lifecycle, and what would move it on: later stages whose requirement is
 * already met (a steward can advance it), then the next proof still needed — from the API's `stageRequirements`.
 * Stages are not strictly sequential; the track shows order, not a gate.
 */
export function StageProgress({ idea }: { idea: Pick<IdeaDetail, "stage" | "stageRequirements"> }) {
  const vocabulary = useVocabulary();
  const current = stageOrdinal(idea.stage);
  const ahead = idea.stageRequirements.filter((r) => stageOrdinal(r.stage) > current);
  const ready = ahead.filter((r) => r.met);
  const next = ahead.find((r) => !r.met);
  const label = (stage: IdeaStage) => vocabulary.stage(stage).label;
  return (
    <div className={styles.progress}>
      <div
        className={styles.track}
        role="img"
        aria-label={`Stage ${current + 1} of ${IDEA_STAGES.length}: ${label(idea.stage)}`}
      >
        {IDEA_STAGES.map((s, i) => (
          <span key={s} className={cx(styles.segment, i <= current && styles.segmentOn)} title={label(s)} />
        ))}
      </div>
      <div className={styles.ends} aria-hidden>
        <span>{label(IDEA_STAGES[0])}</span>
        <span>{label(IDEA_STAGES[IDEA_STAGES.length - 1]!)}</span>
      </div>
      {ready.length > 0 && (
        <p className={cx(styles.next, styles.ready)}>
          <CircleCheck aria-hidden />
          <span>
            <b>{formatList(ready.map((r) => label(r.stage)))}</b>: requirement{ready.length > 1 ? "s" : ""}{" "}
            met — a steward can move it on.
          </span>
        </p>
      )}
      {next ? (
        <p className={styles.next}>
          <Flag aria-hidden />
          <span>
            Next proof, for <b>{label(next.stage)}</b>: {next.requirement.replace(/\.$/, "")}.
          </span>
        </p>
      ) : (
        ahead.length === 0 && <p className={styles.next}>The last stage: learning recorded from practice.</p>
      )}
    </div>
  );
}
