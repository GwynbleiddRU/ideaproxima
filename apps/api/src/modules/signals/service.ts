import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type {
  DeclareInvolvementRequest,
  EvaluationDto,
  EvaluationsQuery,
  InvolvementDto,
  Page,
  SubmitEvaluationRequest,
  ViewerState,
  WithdrawEvaluationRequest,
} from "@ideaproxima/contracts";
import {
  DomainError,
  authorize,
  isDimensionKey,
  stancesDisplacedBy,
  validateRatings,
  type Capacity,
  type EvaluationTargetKind,
  type RatingInput,
  type StanceKind,
} from "@ideaproxima/domain";
import { evaluations, involvements, stances } from "../../db/schema";
import { uuidv7 } from "../../lib/ids";
import { findIdea } from "../ideas/queries";
import { refreshIdeaMetrics } from "../metrics/service";
import { recordActivity } from "../shared/activity";
import { inTransaction, type Ctx } from "../shared/context";
import { lockKey } from "../shared/locks";
import { encodeCursor, keysetFrom, splitPage } from "../shared/pagination";
import { iso, isoOrNull, personRefs, refOrUnknown } from "../shared/refs";
import { resolveTarget } from "../shared/targets";

const TARGET_COLUMN = {
  idea: "ideaId",
  claim: "claimId",
  evidence: "evidenceId",
  argument: "argumentId",
  relation: "relationId",
  comment: "commentId",
} as const satisfies Record<EvaluationTargetKind, keyof typeof evaluations.$inferInsert>;

type Target = { kind: EvaluationTargetKind; id: string };

/**
 * Records ratings as new observations. For each dimension, the evaluator's previous current rating (if any) is
 * superseded — never updated in place — so the full history of every opinion remains. Re-submitting an identical
 * rating is a no-op, which makes the operation safely retryable.
 *
 * Exported for internal composition (e.g. a claim author's initial assessment). Must run inside a transaction.
 */
export async function submitRatings(
  ctx: Ctx,
  targetRef: Target,
  ratings: readonly RatingInput[],
  rationale: string,
): Promise<{ submissionId: string; changed: string[] }> {
  authorize(ctx.actor, "signal.express");
  const actorId = ctx.actor.id;
  const valid = validateRatings(targetRef.kind, ratings);
  const target = await resolveTarget(ctx, targetRef.kind, targetRef.id);
  // Serialise this person's submissions on this target so a double submission supersedes cleanly.
  await lockKey(ctx, "evaluation", actorId, target.id);
  if (target.kind === "relation" && target.hidden)
    throw new DomainError("invariant_violated", "This relation was retracted.");
  if (valid.some((r) => r.dimension === "useful") && target.creatorId === actorId) {
    throw new DomainError("invariant_violated", "You cannot mark your own contribution as useful.");
  }

  const targetColumn = TARGET_COLUMN[targetRef.kind];
  const column = evaluations[targetColumn];
  const current = await ctx.db
    .select()
    .from(evaluations)
    .where(
      and(
        eq(evaluations.evaluatorId, actorId),
        eq(column, target.id),
        isNull(evaluations.supersededAt),
        inArray(
          evaluations.dimension,
          valid.map((r) => r.dimension),
        ),
      ),
    );
  const currentByDim = new Map(current.map((r) => [r.dimension, r]));
  const submissionId = uuidv7();
  const changed: string[] = [];
  for (const r of valid) {
    const prev = currentByDim.get(r.dimension);
    if (prev && prev.value === r.value && prev.confidence === r.confidence && prev.rationale === rationale)
      continue;
    if (prev)
      await ctx.db
        .update(evaluations)
        .set({ supersededAt: sql`now()` })
        .where(eq(evaluations.id, prev.id));
    await ctx.db.insert(evaluations).values({
      submissionId,
      evaluatorId: actorId,
      [targetColumn]: target.id,
      dimension: r.dimension,
      value: r.value,
      confidence: r.confidence,
      rationale,
    });
    changed.push(r.dimension);
  }
  if (changed.length) {
    await recordActivity(ctx, {
      action: "evaluation.submitted",
      ideaIds: target.ideaIds,
      subject: { kind: "evaluation_submission", id: submissionId },
      payload: { target: { kind: target.kind, id: target.id }, dimensions: changed },
    });
    if (target.kind === "idea") await refreshIdeaMetrics(ctx, [target.id]);
  }
  return { submissionId, changed };
}

/** The evaluator's current ratings of a target. */
async function myCurrentRatings(ctx: Ctx, target: Target): Promise<ViewerState["ratings"]> {
  const rows = await ctx.db
    .select({
      dimension: evaluations.dimension,
      value: evaluations.value,
      confidence: evaluations.confidence,
    })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.evaluatorId, ctx.actor!.id),
        eq(evaluations[TARGET_COLUMN[target.kind]], target.id),
        isNull(evaluations.supersededAt),
      ),
    );
  return rows.flatMap((r) => (isDimensionKey(r.dimension) ? [{ ...r, dimension: r.dimension }] : []));
}

export async function submitEvaluation(ctx: Ctx, input: SubmitEvaluationRequest) {
  const result = await inTransaction(ctx, (tx) =>
    submitRatings(tx, input.target, input.ratings, input.rationale ?? ""),
  );
  return { ...result, current: await myCurrentRatings(ctx, input.target) };
}

/** Withdraws ratings ("I no longer hold this view"): supersedes them without a successor. */
export async function withdrawEvaluation(ctx: Ctx, input: WithdrawEvaluationRequest) {
  authorize(ctx.actor, "signal.express");
  const actorId = ctx.actor.id;
  await inTransaction(ctx, async (tx) => {
    const target = await resolveTarget(tx, input.target.kind, input.target.id);
    await lockKey(tx, "evaluation", actorId, target.id);
    const withdrawn = await tx.db
      .update(evaluations)
      .set({ supersededAt: sql`now()` })
      .where(
        and(
          eq(evaluations.evaluatorId, actorId),
          eq(evaluations[TARGET_COLUMN[input.target.kind]], target.id),
          inArray(evaluations.dimension, input.dimensions),
          isNull(evaluations.supersededAt),
        ),
      )
      .returning({ dimension: evaluations.dimension });
    if (withdrawn.length) {
      // A withdrawal creates no rows, so the subject is the evaluated target itself.
      await recordActivity(tx, {
        action: "evaluation.withdrawn",
        ideaIds: target.ideaIds,
        subject: { kind: target.kind, id: target.id },
        payload: { dimensions: withdrawn.map((w) => w.dimension) },
      });
      if (target.kind === "idea") await refreshIdeaMetrics(tx, [target.id]);
    }
  });
  return { current: await myCurrentRatings(ctx, input.target) };
}

/**
 * The raw observations behind every rating summary — published for transparency and for researchers.
 * `history=all` includes superseded ratings, so opinion change over time can be studied.
 */
export async function listEvaluations(ctx: Ctx, query: EvaluationsQuery): Promise<Page<EvaluationDto>> {
  await resolveTarget(ctx, query.targetKind, query.targetId);
  const after = keysetFrom(query.cursor);
  const rows = await ctx.db
    .select()
    .from(evaluations)
    .where(
      and(
        eq(evaluations.targetId, query.targetId),
        query.history === "current" ? isNull(evaluations.supersededAt) : undefined,
        after
          ? or(
              lt(evaluations.createdAt, after.t),
              and(eq(evaluations.createdAt, after.t), lt(evaluations.id, after.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(evaluations.createdAt), desc(evaluations.id))
    .limit(query.limit + 1);
  const { items, hasMore } = splitPage(rows, query.limit);
  const refs = await personRefs(
    ctx.db,
    items.map((r) => r.evaluatorId),
  );
  const last = items.at(-1);
  return {
    items: items.map((r) => ({
      id: r.id,
      submissionId: r.submissionId,
      evaluator: refOrUnknown(refs, r.evaluatorId),
      target: { kind: r.targetKind!, id: r.targetId! },
      dimension: r.dimension,
      value: r.value,
      confidence: r.confidence,
      rationale: r.rationale,
      createdAt: iso(r.createdAt),
      supersededAt: isoOrNull(r.supersededAt),
    })),
    nextCursor: hasMore && last ? encodeCursor({ t: iso(last.createdAt), id: last.id }) : null,
  };
}

// ---------------------------------------------------------------- stances

async function myStances(ctx: Ctx, ideaId: string): Promise<StanceKind[]> {
  const rows = await ctx.db
    .select({ kind: stances.kind })
    .from(stances)
    .where(and(eq(stances.ideaId, ideaId), eq(stances.personId, ctx.actor!.id), isNull(stances.retractedAt)));
  return rows.map((r) => r.kind);
}

/** Takes a stance on an idea. Idempotent; taking a stance retracts any mutually exclusive one. */
export async function takeStance(
  ctx: Ctx,
  ideaRef: string,
  kind: StanceKind,
): Promise<{ stances: StanceKind[] }> {
  authorize(ctx.actor, "signal.express");
  const actorId = ctx.actor.id;
  const ideaId = await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    await lockKey(tx, "stance", actorId, idea.id);
    const held = await myStances(tx, idea.id);
    if (held.includes(kind)) return idea.id;
    const displaced = stancesDisplacedBy(kind).filter((k) => held.includes(k));
    if (displaced.length) {
      const retracted = await tx.db
        .update(stances)
        .set({ retractedAt: sql`now()` })
        .where(
          and(
            eq(stances.ideaId, idea.id),
            eq(stances.personId, actorId),
            inArray(stances.kind, displaced),
            isNull(stances.retractedAt),
          ),
        )
        .returning({ id: stances.id, kind: stances.kind });
      for (const r of retracted) {
        await recordActivity(tx, {
          action: "stance.retracted",
          ideaIds: [idea.id],
          subject: { kind: "stance", id: r.id },
          payload: { kind: r.kind, displacedBy: kind },
        });
      }
    }
    const [row] = await tx.db
      .insert(stances)
      .values({ personId: actorId, ideaId: idea.id, kind })
      .returning();
    await recordActivity(tx, {
      action: "stance.taken",
      ideaIds: [idea.id],
      subject: { kind: "stance", id: row!.id },
      payload: { kind },
    });
    await refreshIdeaMetrics(tx, [idea.id]);
    return idea.id;
  });
  return { stances: await myStances(ctx, ideaId) };
}

export async function retractStance(
  ctx: Ctx,
  ideaRef: string,
  kind: StanceKind,
): Promise<{ stances: StanceKind[] }> {
  authorize(ctx.actor, "signal.express");
  const actorId = ctx.actor.id;
  const ideaId = await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    await lockKey(tx, "stance", actorId, idea.id);
    const retracted = await tx.db
      .update(stances)
      .set({ retractedAt: sql`now()` })
      .where(
        and(
          eq(stances.ideaId, idea.id),
          eq(stances.personId, actorId),
          eq(stances.kind, kind),
          isNull(stances.retractedAt),
        ),
      )
      .returning({ id: stances.id });
    if (retracted.length) {
      await recordActivity(tx, {
        action: "stance.retracted",
        ideaIds: [idea.id],
        subject: { kind: "stance", id: retracted[0]!.id },
        payload: { kind },
      });
      await refreshIdeaMetrics(tx, [idea.id]);
    }
    return idea.id;
  });
  return { stances: await myStances(ctx, ideaId) };
}

// ---------------------------------------------------------------- involvements

export async function listInvolvements(ctx: Ctx, ideaRef: string): Promise<InvolvementDto[]> {
  const idea = await findIdea(ctx, ideaRef);
  const rows = await ctx.db
    .select()
    .from(involvements)
    .where(and(eq(involvements.ideaId, idea.id), isNull(involvements.supersededAt)))
    .orderBy(asc(involvements.createdAt));
  const refs = await personRefs(
    ctx.db,
    rows.map((r) => r.personId),
  );
  return rows.map((r) => ({
    person: refOrUnknown(refs, r.personId),
    capacity: r.capacity,
    status: r.status,
    note: r.note,
    since: iso(r.createdAt),
  }));
}

/** Declares (or updates) how the actor is involved with an idea in one capacity. The previous state is superseded. */
export async function declareInvolvement(
  ctx: Ctx,
  ideaRef: string,
  capacity: Capacity,
  input: DeclareInvolvementRequest,
): Promise<InvolvementDto[]> {
  authorize(ctx.actor, "signal.express");
  const actorId = ctx.actor.id;
  const ideaId = await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    await lockKey(tx, "involvement", actorId, idea.id, capacity);
    const [current] = await tx.db
      .select()
      .from(involvements)
      .where(
        and(
          eq(involvements.ideaId, idea.id),
          eq(involvements.personId, actorId),
          eq(involvements.capacity, capacity),
          isNull(involvements.supersededAt),
        ),
      );
    if (current && current.status === input.status && current.note === (input.note ?? "")) return idea.id;
    if (current)
      await tx.db
        .update(involvements)
        .set({ supersededAt: sql`now()` })
        .where(eq(involvements.id, current.id));
    const [row] = await tx.db
      .insert(involvements)
      .values({ personId: actorId, ideaId: idea.id, capacity, status: input.status, note: input.note ?? "" })
      .returning();
    await recordActivity(tx, {
      action: "involvement.declared",
      ideaIds: [idea.id],
      subject: { kind: "involvement", id: row!.id },
      payload: { capacity, status: input.status, previous: current?.status ?? null },
    });
    return idea.id;
  });
  return listInvolvements(ctx, ideaId);
}

export async function withdrawInvolvement(
  ctx: Ctx,
  ideaRef: string,
  capacity: Capacity,
): Promise<InvolvementDto[]> {
  authorize(ctx.actor, "signal.express");
  const actorId = ctx.actor.id;
  const ideaId = await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    await lockKey(tx, "involvement", actorId, idea.id, capacity);
    const ended = await tx.db
      .update(involvements)
      .set({ supersededAt: sql`now()` })
      .where(
        and(
          eq(involvements.ideaId, idea.id),
          eq(involvements.personId, actorId),
          eq(involvements.capacity, capacity),
          isNull(involvements.supersededAt),
        ),
      )
      .returning({ id: involvements.id });
    if (ended.length) {
      await recordActivity(tx, {
        action: "involvement.withdrawn",
        ideaIds: [idea.id],
        subject: { kind: "involvement", id: ended[0]!.id },
        payload: { capacity },
      });
    }
    return idea.id;
  });
  return listInvolvements(ctx, ideaId);
}
