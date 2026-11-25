import { Suspense, createContext, lazy, use, useState, type ReactNode } from "react";
import type { IdeaDetail } from "@ideaproxima/contracts";
import { useAuthGate } from "@/components/auth";

const IdeaActionDialogs = lazy(() => import("./IdeaActionDialogs"));

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
  // Load on first use, then keep the native dialogs mounted so closing restores focus.
  const [dialog, setDialog] = useState<"evaluate" | "involve" | "stage" | null>();
  const close = () => setDialog(null);
  const actions: IdeaActions = {
    evaluate: () => gate(() => setDialog("evaluate")),
    involve: () => gate(() => setDialog("involve")),
    changeStage: () => setDialog("stage"),
  };
  return (
    <IdeaActionsContext value={actions}>
      {children}
      {dialog !== undefined && (
        <Suspense fallback={null}>
          <IdeaActionDialogs idea={idea} dialog={dialog} onClose={close} />
        </Suspense>
      )}
    </IdeaActionsContext>
  );
}

export function useIdeaActions(): IdeaActions {
  const actions = use(IdeaActionsContext);
  if (!actions) throw new Error("useIdeaActions needs an IdeaActionsProvider");
  return actions;
}
