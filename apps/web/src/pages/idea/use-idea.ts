import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { IdeaDetail } from "@ideaproxima/contracts";
import { ideaQueries } from "@/api/ideas";
import { keys } from "@/api/keys";
import { useSession } from "@/api/session";

const ideaRoute = getRouteApi("/ideas/$idea");

/** The idea of the current route. The route loader has already put it in the cache. */
export function useIdea(): IdeaDetail {
  const { idea } = ideaRoute.useParams();
  return useSuspenseQuery(ideaQueries.detail(idea)).data;
}

/** Query keys every idea mutation should refresh (the idea itself and the discovery lists). */
export const ideaInvalidations = (idea: IdeaDetail) => [keys.idea(idea.slug), keys.allIdeas] as const;

/**
 * What the viewer may do with this idea, mirroring the API's permission policy (packages/domain
 * rules/permissions.ts) so the UI only offers actions that will succeed. The API still enforces every rule.
 */
export function usePermissions(idea: IdeaDetail) {
  const { me, isModerator } = useSession();
  const steward = !!idea.viewer?.isSteward;
  return {
    signedIn: !!me,
    isModerator,
    isSteward: steward,
    /** Publish revisions, decide proposals, change stage, appoint stewards. */
    canSteward: steward || isModerator,
    /** Unlink claims, retract relations, manage an initiative. */
    canCurate: (creatorId?: string) => steward || isModerator || (!!me && creatorId === me.id),
    /** Withdraw a contribution. */
    canWithdraw: (authorId: string) => isModerator || (!!me && authorId === me.id),
    isMe: (personId: string) => !!me && personId === me.id,
  };
}
