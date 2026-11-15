import { Hono } from "hono";
import {
  AttachEvidenceRequest,
  CreateArgumentRequest,
  EvaluationsQuery,
  ModerationRequest,
  ProposeRelationRequest,
  RecordOutcomeRequest,
  SourceInput,
  SubmitEvaluationRequest,
  UpdateInitiativeStatusRequest,
  WithdrawEvaluationRequest,
  WithdrawRequest,
} from "@ideaproxima/contracts";
import * as graph from "../../modules/graph/service";
import * as knowledge from "../../modules/knowledge/service";
import { moderate } from "../../modules/moderation/service";
import * as practice from "../../modules/practice/service";
import * as signals from "../../modules/signals/service";
import type { AppEnv } from "../env";
import { jsonBody, queryOf, uuidParam } from "../input";

/** Resources with their own identity, addressed directly by id (claims are shared across ideas, etc.). */
export const resourceRoutes = new Hono<AppEnv>()
  // ---- claims, evidence, sources
  .get("/claims/:claim", async (c) => c.json(await knowledge.getClaim(c.get("ctx"), uuidParam(c, "claim"))))
  .post("/claims/:claim/evidence", async (c) =>
    c.json(
      await knowledge.attachEvidence(
        c.get("ctx"),
        uuidParam(c, "claim"),
        await jsonBody(c, AttachEvidenceRequest),
      ),
      201,
    ),
  )
  .post("/evidence/:evidence/withdraw", async (c) =>
    c.json(
      await knowledge.withdrawEvidence(
        c.get("ctx"),
        uuidParam(c, "evidence"),
        (await jsonBody(c, WithdrawRequest)).reason,
      ),
    ),
  )
  .post("/sources", async (c) => {
    const { source, created } = await knowledge.registerSource(c.get("ctx"), await jsonBody(c, SourceInput));
    return c.json(source, created ? 201 : 200);
  })
  .get("/sources/:source", async (c) =>
    c.json(await knowledge.getSource(c.get("ctx"), uuidParam(c, "source"))),
  )

  // ---- arguments
  .post("/arguments", async (c) =>
    c.json(await knowledge.createArgument(c.get("ctx"), await jsonBody(c, CreateArgumentRequest)), 201),
  )
  .get("/arguments/:argument", async (c) =>
    c.json(await knowledge.getArgument(c.get("ctx"), uuidParam(c, "argument"))),
  )
  .post("/arguments/:argument/withdraw", async (c) =>
    c.json(await knowledge.withdrawArgument(c.get("ctx"), uuidParam(c, "argument"))),
  )

  // ---- evaluations (raw observations are public)
  .get("/evaluations", async (c) =>
    c.json(await signals.listEvaluations(c.get("ctx"), queryOf(c, EvaluationsQuery))),
  )
  .post("/evaluations", async (c) =>
    c.json(await signals.submitEvaluation(c.get("ctx"), await jsonBody(c, SubmitEvaluationRequest))),
  )
  .post("/evaluations/withdraw", async (c) =>
    c.json(await signals.withdrawEvaluation(c.get("ctx"), await jsonBody(c, WithdrawEvaluationRequest))),
  )

  // ---- graph
  .post("/relations", async (c) =>
    c.json(await graph.proposeRelation(c.get("ctx"), await jsonBody(c, ProposeRelationRequest)), 201),
  )
  .post("/relations/:relation/retract", async (c) => {
    await graph.retractRelation(c.get("ctx"), uuidParam(c, "relation"));
    return c.json({ ok: true });
  })

  // ---- initiatives & outcomes
  .get("/initiatives/:initiative", async (c) =>
    c.json(await practice.getInitiative(c.get("ctx"), uuidParam(c, "initiative"))),
  )
  .post("/initiatives/:initiative/status", async (c) =>
    c.json(
      await practice.updateInitiativeStatus(
        c.get("ctx"),
        uuidParam(c, "initiative"),
        await jsonBody(c, UpdateInitiativeStatusRequest),
      ),
    ),
  )
  .post("/initiatives/:initiative/outcomes", async (c) =>
    c.json(
      await practice.recordOutcome(
        c.get("ctx"),
        uuidParam(c, "initiative"),
        await jsonBody(c, RecordOutcomeRequest),
      ),
      201,
    ),
  )

  // ---- moderation (the log is public: GET /v1/activity?action=moderation.)
  .post("/moderation", async (c) =>
    c.json(await moderate(c.get("ctx"), await jsonBody(c, ModerationRequest))),
  );
