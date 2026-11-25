import type { IdeaDetail } from "@ideaproxima/contracts";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import { InvolveDialog } from "./InvolveDialog";
import { StageDialog } from "./StageDialog";
import { ideaInvalidations } from "./use-idea";

export default function IdeaActionDialogs({
  idea,
  dialog,
  onClose,
}: {
  idea: IdeaDetail;
  dialog: "evaluate" | "involve" | "stage" | null;
  onClose: () => void;
}) {
  return (
    <>
      <EvaluateDialog
        open={dialog === "evaluate"}
        onClose={onClose}
        target={{ kind: "idea", id: idea.id }}
        subject={idea.title}
        invalidate={ideaInvalidations(idea)}
      />
      <InvolveDialog open={dialog === "involve"} onClose={onClose} idea={idea} />
      <StageDialog open={dialog === "stage"} onClose={onClose} idea={idea} />
    </>
  );
}
