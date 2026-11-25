import { vocabularyField } from "@/lib/vocabulary";
import { useLocale } from "@/locales/react";
import {
  CheckCheck,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleSlash,
  CircleX,
  FlaskConical,
  Scale,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import {
  ARGUMENT_STANCE_INFO,
  CLAIM_STATUS_INFO,
  EVIDENCE_STANCE_INFO,
  OUTCOME_RESULT_INFO,
  type ArgumentStance,
  type ClaimStatus,
  type EvidenceStance,
  type OutcomeResult,
} from "@ideaproxima/domain";
import { Badge } from "@/ui/Badge";

/**
 * Epistemic and stance badges. Each pairs a colour token with an icon and a label, so meaning never depends on
 * colour alone; the description from the vocabulary is the tooltip.
 */

const CLAIM_STATUS_ICON: Record<ClaimStatus, LucideIcon> = {
  unassessed: CircleDashed,
  established: CheckCheck,
  supported: CircleCheck,
  hypothesis: FlaskConical,
  unknown: CircleHelp,
  doubtful: TrendingDown,
  refuted: CircleX,
  contested: Scale,
};

export const claimStatusColor = (status: ClaimStatus) => `var(--status-${status})`;

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  useLocale();
  const Icon = CLAIM_STATUS_ICON[status];
  const info = CLAIM_STATUS_INFO[status];
  return (
    <Badge
      color={claimStatusColor(status)}
      icon={<Icon aria-hidden />}
      title={vocabularyField("claimStatuses", status, "description", info.description)}
    >
      {vocabularyField("claimStatuses", status, "label", info.label)}
    </Badge>
  );
}

const STANCE_COLOR = {
  supports: "var(--status-established)",
  challenges: "var(--status-refuted)",
  opposes: "var(--status-refuted)",
  mixed: "var(--status-hypothesis)",
  qualifies: "var(--status-hypothesis)",
} as const;

export function EvidenceStanceBadge({ stance }: { stance: EvidenceStance }) {
  useLocale();
  const info = EVIDENCE_STANCE_INFO[stance];
  return (
    <Badge
      color={STANCE_COLOR[stance]}
      title={vocabularyField("evidenceStances", stance, "description", info.description)}
    >
      {vocabularyField("evidenceStances", stance, "label", info.label)}
    </Badge>
  );
}

export function ArgumentStanceBadge({ stance }: { stance: ArgumentStance }) {
  useLocale();
  const info = ARGUMENT_STANCE_INFO[stance];
  return (
    <Badge
      color={STANCE_COLOR[stance]}
      title={vocabularyField("argumentStances", stance, "description", info.description)}
    >
      {vocabularyField("argumentStances", stance, "label", info.label)}
    </Badge>
  );
}

export const argumentStanceColor = (stance: ArgumentStance) => STANCE_COLOR[stance];

const OUTCOME_TONE: Record<OutcomeResult, "success" | "warning" | "danger" | "neutral"> = {
  succeeded: "success",
  partially_succeeded: "warning",
  failed: "danger",
  inconclusive: "neutral",
};

export function OutcomeBadge({ result }: { result: OutcomeResult }) {
  useLocale();
  const info = OUTCOME_RESULT_INFO[result];
  return (
    <Badge
      tone={OUTCOME_TONE[result]}
      title={vocabularyField("outcomeResults", result, "description", info.description)}
      icon={result === "failed" ? <CircleSlash aria-hidden /> : undefined}
    >
      {vocabularyField("outcomeResults", result, "label", info.label)}
    </Badge>
  );
}
