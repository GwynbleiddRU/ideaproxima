import { Hono } from "hono";
import {
  AddClaimRequest,
  AppointStewardRequest,
  DecideRevisionRequest,
  DeclareInvolvementRequest,
  CreateInitiativeRequest,
  GraphQuery,
  ListIdeasQuery,
  PageQuery,
  PostCommentRequest,
  RevisionsQuery,
  ProposeIdeaRequest,
  StageTransitionRequest,
  SubmitRevisionRequest,
} from "@ideaproxima/contracts";
import { CAPACITIES, STANCE_KINDS } from "@ideaproxima/domain";
import * as discussion from "../../modules/discussion/service";
import * as graph from "../../modules/graph/service";
import * as history from "../../modules/history/service";
import * as queries from "../../modules/ideas/queries";
import * as ideas from "../../modules/ideas/service";
import * as knowledge from "../../modules/knowledge/service";
import * as practice from "../../modules/practice/service";
import * as signals from "../../modules/signals/service";
import type { AppEnv } from "../env";
import { enumParam, jsonBody, queryOf, uuidParam } from "../input";

/**
 * Everything addressed through an idea. `:idea` accepts the idea's id or its slug, so URLs can be human-readable
 * while integrations use stable ids.
 */
export const ideaRoutes = new Hono<AppEnv>()
  // ---- the idea itself
  .get("/ideas", async (c) => c.json(await queries.listIdeas(c.get("ctx"), queryOf(c, ListIdeasQuery))))
  .post("/ideas", async (c) =>
    c.json(await ideas.proposeIdea(c.get("ctx"), await jsonBody(c, ProposeIdeaRequest)), 201),
  )
  .get("/ideas/:idea", async (c) => c.json(await queries.getIdeaDetail(c.get("ctx"), c.req.param("idea"))))

  // ---- narrative history
  .get("/ideas/:idea/revisions", async (c) => {
    const { status } = queryOf(c, RevisionsQuery);
    return c.json(await queries.listRevisions(c.get("ctx"), c.req.param("idea"), status));
  })
  .post("/ideas/:idea/revisions", async (c) =>
    c.json(
      await ideas.submitRevision(c.get("ctx"), c.req.param("idea"), await jsonBody(c, SubmitRevisionRequest)),
      201,
    ),
  )
  .get("/ideas/:idea/revisions/:revision", async (c) =>
    c.json(await queries.getRevision(c.get("ctx"), c.req.param("idea"), uuidParam(c, "revision"))),
  )
  .post("/ideas/:idea/revisions/:revision/decision", async (c) =>
    c.json(
      await ideas.decideRevision(
        c.get("ctx"),
        c.req.param("idea"),
        uuidParam(c, "revision"),
        await jsonBody(c, DecideRevisionRequest),
      ),
    ),
  )
  .post("/ideas/:idea/revisions/:revision/withdraw", async (c) =>
    c.json(await ideas.withdrawRevision(c.get("ctx"), c.req.param("idea"), uuidParam(c, "revision"))),
  )
  .post("/ideas/:idea/stewards", async (c) =>
    c.json(
      await ideas.appointSteward(c.get("ctx"), c.req.param("idea"), await jsonBody(c, AppointStewardRequest)),
      201,
    ),
  )

  // ---- lifecycle
  .get("/ideas/:idea/stages", async (c) =>
    c.json(await queries.listStageHistory(c.get("ctx"), c.req.param("idea"))),
  )
  .post("/ideas/:idea/stages", async (c) =>
    c.json(
      await ideas.transitionStage(
        c.get("ctx"),
        c.req.param("idea"),
        await jsonBody(c, StageTransitionRequest),
      ),
      201,
    ),
  )
  .get("/ideas/:idea/timeline", async (c) => {
    const q = queryOf(c, PageQuery);
    return c.json(await history.ideaTimeline(c.get("ctx"), c.req.param("idea"), q.limit, q.cursor));
  })

  // ---- knowledge structure
  .get("/ideas/:idea/claims", async (c) =>
    c.json(await knowledge.listIdeaClaims(c.get("ctx"), c.req.param("idea"))),
  )
  .post("/ideas/:idea/claims", async (c) =>
    c.json(
      await knowledge.addClaimToIdea(c.get("ctx"), c.req.param("idea"), await jsonBody(c, AddClaimRequest)),
      201,
    ),
  )
  .post("/ideas/:idea/claims/:link/unlink", async (c) => {
    await knowledge.unlinkClaim(c.get("ctx"), c.req.param("idea"), uuidParam(c, "link"));
    return c.json({ ok: true });
  })
  .get("/ideas/:idea/arguments", async (c) =>
    c.json(await knowledge.listIdeaArguments(c.get("ctx"), c.req.param("idea"))),
  )

  // ---- graph
  .get("/ideas/:idea/relations", async (c) =>
    c.json(await graph.listIdeaRelations(c.get("ctx"), c.req.param("idea"))),
  )
  .get("/ideas/:idea/graph", async (c) =>
    c.json(await graph.traverseGraph(c.get("ctx"), c.req.param("idea"), queryOf(c, GraphQuery))),
  )

  // ---- action in the world
  .get("/ideas/:idea/initiatives", async (c) =>
    c.json(await practice.listIdeaInitiatives(c.get("ctx"), c.req.param("idea"))),
  )
  .post("/ideas/:idea/initiatives", async (c) =>
    c.json(
      await practice.createInitiative(
        c.get("ctx"),
        c.req.param("idea"),
        await jsonBody(c, CreateInitiativeRequest),
      ),
      201,
    ),
  )

  // ---- people and signals
  .get("/ideas/:idea/involvements", async (c) =>
    c.json(await signals.listInvolvements(c.get("ctx"), c.req.param("idea"))),
  )
  .put("/ideas/:idea/involvements/:capacity", async (c) =>
    c.json(
      await signals.declareInvolvement(
        c.get("ctx"),
        c.req.param("idea"),
        enumParam(c, "capacity", CAPACITIES),
        await jsonBody(c, DeclareInvolvementRequest),
      ),
    ),
  )
  .delete("/ideas/:idea/involvements/:capacity", async (c) =>
    c.json(
      await signals.withdrawInvolvement(
        c.get("ctx"),
        c.req.param("idea"),
        enumParam(c, "capacity", CAPACITIES),
      ),
    ),
  )
  .put("/ideas/:idea/stances/:kind", async (c) =>
    c.json(await signals.takeStance(c.get("ctx"), c.req.param("idea"), enumParam(c, "kind", STANCE_KINDS))),
  )
  .delete("/ideas/:idea/stances/:kind", async (c) =>
    c.json(
      await signals.retractStance(c.get("ctx"), c.req.param("idea"), enumParam(c, "kind", STANCE_KINDS)),
    ),
  )

  // ---- discussion
  .get("/ideas/:idea/comments", async (c) => {
    const q = queryOf(c, PageQuery);
    return c.json(await discussion.listComments(c.get("ctx"), c.req.param("idea"), q.limit, q.cursor));
  })
  .post("/ideas/:idea/comments", async (c) =>
    c.json(
      await discussion.postComment(c.get("ctx"), c.req.param("idea"), await jsonBody(c, PostCommentRequest)),
      201,
    ),
  );
