import { createContext, use, useState, type ReactNode } from "react";
import type { IdeaDetail } from "@ideaproxima/contracts";
import { useAuthGate } from "@/components/auth";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import { InvolveDialog } from "./InvolveDialog";
import { StageDialog } from "./StageDialog";
import { ideaInvalidations } from "./use-idea";

interface IdeaActions {
  /** Open the evaluation dialog (visitors are sent to sign in first). */
  evaluate: () => void;
  /** Open "I can help". */
  involve: () => void;
  /** Open the stage dialog (stewards). */
  changeStage: () => void;
}

const IdeaActionsContext = createContext<IdeaActions | null>(null);

/**
 * The idea's dialogs, mounted once for the whole page: the header, the sticky tabs bar and the sidebar all
 * open the same ones.
 */
export function IdeaActionsProvider({ idea, children }: { idea: IdeaDetail; children: ReactNode }) {
  const gate = useAuthGate();
  const [dialog, setDialog] = useState<"evaluate" | "involve" | "stage" | null>(null);
  const close = () => setDialog(null);
  const actions: IdeaActions = {
    evaluate: () => gate(() => setDialog("evaluate")),
    involve: () => gate(() => setDialog("involve")),
    changeStage: () => setDialog("stage"),
  };
  return (
    <IdeaActionsContext value={actions}>
      {children}
      <EvaluateDialog
        open={dialog === "evaluate"}
        onClose={close}
        target={{ kind: "idea", id: idea.id }}
        subject={idea.title}
        invalidate={ideaInvalidations(idea)}
      />
      <InvolveDialog open={dialog === "involve"} onClose={close} idea={idea} />
      <StageDialog open={dialog === "stage"} onClose={close} idea={idea} />
    </IdeaActionsContext>
  );
}

export function useIdeaActions(): IdeaActions {
  const actions = use(IdeaActionsContext);
  if (!actions) throw new Error("useIdeaActions needs an IdeaActionsProvider");
  return actions;
}
