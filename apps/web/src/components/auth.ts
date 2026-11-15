import { useLocation, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/api/session";

/**
 * Wraps an action that needs an account: signed-in people run it; visitors are sent to sign in and brought
 * back to this page afterwards. Reading never requires an account.
 */
export function useAuthGate() {
  const { me } = useSession();
  const navigate = useNavigate();
  const href = useLocation({ select: (l) => l.href });
  return (action: () => void) => {
    if (me) action();
    else void navigate({ to: "/sign-in", search: { redirect: href } });
  };
}
