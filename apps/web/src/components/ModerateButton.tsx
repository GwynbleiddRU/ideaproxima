import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ModeratableKind } from "@ideaproxima/contracts";
import { useModerate } from "@/api/catalog";
import { useSession } from "@/api/session";
import { Button } from "@/ui/Button";
import { ReasonDialog } from "./ReasonDialog";

/**
 * Hide / restore, for moderators only. Hiding never deletes: the content keeps its place in the record and the
 * action, with its reason, appears in the public moderation log.
 */
export function ModerateButton({ kind, id, hidden }: { kind: ModeratableKind; id: string; hidden: boolean }) {
  const { isModerator } = useSession();
  const moderate = useModerate();
  const [open, setOpen] = useState(false);
  if (!isModerator) return null;
  return (
    <>
      <Button variant="quiet" size="sm" icon={hidden ? <Eye /> : <EyeOff />} onClick={() => setOpen(true)}>
        {hidden ? "Restore" : "Hide"}
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={hidden ? `Restore this ${kind}` : `Hide this ${kind}`}
        description={
          hidden
            ? "It becomes publicly visible again."
            : "It disappears from public views but stays in the record. The reason is published in the moderation log."
        }
        confirmLabel={hidden ? "Restore" : "Hide"}
        danger={!hidden}
        onConfirm={(reason) =>
          moderate.mutateAsync({ target: { kind, id }, action: hidden ? "restore" : "hide", reason })
        }
      />
    </>
  );
}
