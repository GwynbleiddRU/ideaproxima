import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
} from "@tanstack/react-router";
import { catalogQueries } from "@/api/catalog";
import { graphQueries } from "@/api/graph";
import { isApiError } from "@/api/http";
import { ideaQueries } from "@/api/ideas";
import { knowledgeQueries } from "@/api/knowledge";
import { peopleQueries } from "@/api/people";
import { practiceQueries } from "@/api/practice";
import { meQuery } from "@/api/session";
import { signalQueries } from "@/api/signals";
import { LocaleProvider } from "@/locales/react";
import { loadExtendedEnglish } from "@/locales/runtime";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RouteError } from "./RouteError";
import {
  parseActivitySearch,
  parseExploreSearch,
  parseGraphSearch,
  parseQuerySearch,
  parseRedirectSearch,
  parseTopicSearch,
} from "./search-params";
import { Shell } from "./Shell";

/**
 * The route tree. Every page is a separate chunk (lazyRouteComponent). Loaders prefetch the data a page needs
 * in parallel with its code, and run on hover/focus of links too (`defaultPreload: "intent"`), so most
 * navigations render instantly from cache.
 */

export interface RouterContext {
  queryClient: QueryClient;
}

async function withExtendedEnglish<T>(page: Promise<T>): Promise<T> {
  const [module] = await Promise.all([page, loadExtendedEnglish()]);
  return module;
}

/** A missing resource is a not-found page, not an error page. */
async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (isApiError(error, 404)) throw notFound();
    throw error;
  }
}

/** Pages that only make sense signed in send visitors to sign in and back. */
async function requireSession({ context, location }: { context: RouterContext; location: { href: string } }) {
  const session = await context.queryClient.ensureQueryData(meQuery);
  if (!session) throw redirect({ to: "/sign-in", search: { redirect: location.href } });
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  shellComponent: LocaleProvider,
  component: Shell,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteError,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => withExtendedEnglish(import("@/pages/home/HomePage")), "HomePage"),
});

const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "explore",
  validateSearch: parseExploreSearch,
  component: lazyRouteComponent(() => import("@/pages/explore/ExplorePage"), "ExplorePage"),
});

const topicsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "topics",
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueries.topics()),
  component: lazyRouteComponent(() => withExtendedEnglish(import("@/pages/topics/TopicsPage")), "TopicsPage"),
});

const topicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "topics/$slug",
  validateSearch: parseTopicSearch,
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(catalogQueries.topic(params.slug))),
  component: lazyRouteComponent(() => withExtendedEnglish(import("@/pages/topics/TopicPage")), "TopicPage"),
});

// ---------------------------------------------------------------- an idea and its views

const ideaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "ideas/$idea",
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(ideaQueries.detail(params.idea))),
  component: lazyRouteComponent(() => import("@/pages/idea/IdeaLayout"), "IdeaLayout"),
});

const ideaOverviewRoute = createRoute({
  getParentRoute: () => ideaRoute,
  path: "/",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(knowledgeQueries.ideaClaims(params.idea));
  },
  component: lazyRouteComponent(() => import("@/pages/idea/OverviewTab"), "OverviewTab"),
});

const ideaEvidenceRoute = createRoute({
  getParentRoute: () => ideaRoute,
  path: "evidence",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(knowledgeQueries.ideaClaims(params.idea));
  },
  component: lazyRouteComponent(() => import("@/pages/idea/EvidenceTab"), "EvidenceTab"),
});

const ideaDiscussionRoute = createRoute({
  getParentRoute: () => ideaRoute,
  path: "discussion",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(knowledgeQueries.ideaArguments(params.idea));
  },
  component: lazyRouteComponent(() => import("@/pages/idea/DiscussionTab"), "DiscussionTab"),
});

const ideaConnectionsRoute = createRoute({
  getParentRoute: () => ideaRoute,
  path: "connections",
  validateSearch: parseGraphSearch,
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(graphQueries.relations(params.idea));
  },
  component: lazyRouteComponent(() => import("@/pages/idea/ConnectionsTab"), "ConnectionsTab"),
});

const ideaPracticeRoute = createRoute({
  getParentRoute: () => ideaRoute,
  path: "practice",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(practiceQueries.initiatives(params.idea));
    void context.queryClient.prefetchQuery(signalQueries.involvements(params.idea));
  },
  component: lazyRouteComponent(() => import("@/pages/idea/PracticeTab"), "PracticeTab"),
});

const ideaHistoryRoute = createRoute({
  getParentRoute: () => ideaRoute,
  path: "history",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(ideaQueries.revisions(params.idea));
    void context.queryClient.prefetchQuery(ideaQueries.stages(params.idea));
  },
  component: lazyRouteComponent(() => withExtendedEnglish(import("@/pages/idea/HistoryTab")), "HistoryTab"),
});

const ideaEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "ideas/$idea/edit",
  beforeLoad: requireSession,
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(ideaQueries.detail(params.idea))),
  component: lazyRouteComponent(
    () => withExtendedEnglish(import("@/pages/editor/EditIdeaPage")),
    "EditIdeaPage",
  ),
});

const newIdeaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "new",
  beforeLoad: requireSession,
  component: lazyRouteComponent(
    () => withExtendedEnglish(import("@/pages/editor/NewIdeaPage")),
    "NewIdeaPage",
  ),
});

// ---------------------------------------------------------------- knowledge, people, search

const claimRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "claims/$claim",
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(knowledgeQueries.claim(params.claim))),
  component: lazyRouteComponent(
    () => withExtendedEnglish(import("@/pages/knowledge/ClaimPage")),
    "ClaimPage",
  ),
});

const sourceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "sources/$source",
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(knowledgeQueries.source(params.source))),
  component: lazyRouteComponent(
    () => withExtendedEnglish(import("@/pages/knowledge/SourcePage")),
    "SourcePage",
  ),
});

const personRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "people/$handle",
  loader: ({ context, params }) =>
    orNotFound(context.queryClient.ensureQueryData(peopleQueries.profile(params.handle))),
  component: lazyRouteComponent(() => withExtendedEnglish(import("@/pages/people/PersonPage")), "PersonPage"),
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "account",
  beforeLoad: requireSession,
  component: lazyRouteComponent(
    () => withExtendedEnglish(import("@/pages/people/AccountPage")),
    "AccountPage",
  ),
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "search",
  validateSearch: parseQuerySearch,
  component: lazyRouteComponent(() => withExtendedEnglish(import("@/pages/search/SearchPage")), "SearchPage"),
});

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "activity",
  validateSearch: parseActivitySearch,
  component: lazyRouteComponent(
    () => withExtendedEnglish(import("@/pages/activity/ActivityPage")),
    "ActivityPage",
  ),
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "about",
  component: lazyRouteComponent(() => withExtendedEnglish(import("@/pages/about/AboutPage")), "AboutPage"),
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "sign-in",
  validateSearch: parseRedirectSearch,
  component: lazyRouteComponent(() => import("@/pages/auth/AuthPage"), "SignInPage"),
});

const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "join",
  validateSearch: parseRedirectSearch,
  component: lazyRouteComponent(() => import("@/pages/auth/AuthPage"), "JoinPage"),
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  exploreRoute,
  topicsRoute,
  topicRoute,
  ideaRoute.addChildren([
    ideaOverviewRoute,
    ideaEvidenceRoute,
    ideaDiscussionRoute,
    ideaConnectionsRoute,
    ideaPracticeRoute,
    ideaHistoryRoute,
  ]),
  ideaEditRoute,
  newIdeaRoute,
  claimRoute,
  sourceRoute,
  personRoute,
  accountRoute,
  searchRoute,
  activityRoute,
  aboutRoute,
  signInRoute,
  joinRoute,
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // The query cache decides freshness; the router always asks it.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingMs: 600,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
