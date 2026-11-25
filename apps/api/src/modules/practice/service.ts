import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type {
  CreateInitiativeRequest,
  InitiativeDto,
  OutcomeDto,
  RecordOutcomeRequest,
  UpdateInitiativeStatusRequest,
} from "@ideaproxima/contracts";
import { DomainError, assertInitiativeTransition, authorize, notFound } from "@ideaproxima/domain";
import { initiatives, outcomes, sources } from "../../db/schema";
import { currentStewardIds, findIdea } from "../ideas/queries";
import { sourceDto } from "../knowledge/service";
import { refreshIdeaMetrics } from "../metrics/service";
import { recordActivity } from "../shared/activity";
import { inTransaction, isModerator, type Ctx } from "../shared/context";
import { ideaRefs, iso, personRefs, refOrUnknown } from "../shared/refs";

type InitiativeRow = typeof initiatives.$inferSelect;

const today = () => new Date().toISOString().slice(0, 10);

async function initiativeDtos(ctx: Ctx, rows: InitiativeRow[]): Promise<InitiativeDto[]> {
  if (!rows.length) return [];
  const outcomeRows = await ctx.db
    .select()
    .from(outcomes)
    .where(
      inArray(
        outcomes.initiativeId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(outcomes.recordedAt));
  const sourceIds = outcomeRows.map((o) => o.sourceId).filter((x): x is string => !!x);
  const sourceRows = sourceIds.length
    ? await ctx.db.select().from(sources).where(inArray(sources.id, sourceIds))
    : [];
  const [refs, ideasMap] = await Promise.all([
    personRefs(ctx.db, [
      ...rows.map((r) => r.createdBy),
      ...outcomeRows.map((o) => o.recordedBy),
      ...sourceRows.map((s) => s.registeredBy),
    ]),
    ideaRefs(
      ctx.db,
      rows.map((r) => r.ideaId),
      isModerator(ctx),
    ),
  ]);
  const sourceMap = new Map(sourceRows.map((s) => [s.id, sourceDto(s, refs)]));
  const outcomeDto = (o: typeof outcomes.$inferSelect): OutcomeDto => ({
    id: o.id,
    initiativeId: o.initiativeId,
    result: o.result,
    summary: o.summary,
    lessons: o.lessons,
    source: o.sourceId ? (sourceMap.get(o.sourceId) ?? null) : null,
    recordedBy: refOrUnknown(refs, o.recordedBy),
    recordedAt: iso(o.recordedAt),
  });
  return rows
    .filter((r) => ideasMap.has(r.ideaId))
    .map((r) => ({
      id: r.id,
      idea: ideasMap.get(r.ideaId)!,
      kind: r.kind,
      title: r.title,
      description: r.description,
      organization: r.organization,
      url: r.url,
      status: r.status,
      startedOn: r.startedOn,
      endedOn: r.endedOn,
      createdBy: refOrUnknown(refs, r.createdBy),
      createdAt: iso(r.createdAt),
      hidden: !!r.hiddenAt,
      outcomes: outcomeRows.filter((o) => o.initiativeId === r.id).map(outcomeDto),
    }));
}

async function findInitiative(ctx: Ctx, id: string): Promise<InitiativeRow> {
  const [row] = await ctx.db.select().from(initiatives).where(eq(initiatives.id, id));
  if (!row || (row.hiddenAt && !isModerator(ctx))) throw notFound("initiative_not_found");
  return row;
}

/**
 * Records concrete action on an idea. Historical initiatives (a pilot that ran years ago) can be recorded directly
 * as completed: the archive should capture what already happened in the world, not only what happens here.
 */
export async function createInitiative(
  ctx: Ctx,
  ideaRef: string,
  input: CreateInitiativeRequest,
): Promise<InitiativeDto> {
  authorize(ctx.actor, "knowledge.contribute");
  if (input.startedOn && input.endedOn && input.endedOn < input.startedOn) {
    throw new DomainError("validation_failed", "invalid_initiative_dates");
  }
  const row = await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    const [created] = await tx.db
      .insert(initiatives)
      .values({
        ideaId: idea.id,
        kind: input.kind,
        title: input.title,
        description: input.description,
        organization: input.organization ?? "",
        url: input.url ?? null,
        status: input.status,
        startedOn: input.startedOn ?? null,
        endedOn: input.endedOn ?? null,
        createdBy: ctx.actor!.id,
      })
      .returning();
    await recordActivity(tx, {
      action: "initiative.created",
      ideaIds: [idea.id],
      subject: { kind: "initiative", id: created!.id },
      payload: { kind: input.kind, status: input.status, title: input.title },
    });
    await refreshIdeaMetrics(tx, [idea.id]);
    return created!;
  });
  return (await initiativeDtos(ctx, [row]))[0]!;
}

export async function updateInitiativeStatus(
  ctx: Ctx,
  initiativeId: string,
  input: UpdateInitiativeStatusRequest,
): Promise<InitiativeDto> {
  const row = await inTransaction(ctx, async (tx) => {
    const initiative = await findInitiative(tx, initiativeId);
    authorize(ctx.actor, "initiative.manage", {
      isCreator: initiative.createdBy === ctx.actor?.id,
      isSteward: (await currentStewardIds(tx.db, initiative.ideaId)).includes(ctx.actor?.id ?? ""),
    });
    assertInitiativeTransition(initiative.status, input.status);
    const on = input.on ?? today();
    const [updated] = await tx.db
      .update(initiatives)
      .set({
        status: input.status,
        startedOn: input.status === "active" && !initiative.startedOn ? on : initiative.startedOn,
        endedOn: input.status === "completed" || input.status === "discontinued" ? on : initiative.endedOn,
      })
      .where(eq(initiatives.id, initiative.id))
      .returning();
    await recordActivity(tx, {
      action: "initiative.status_changed",
      ideaIds: [initiative.ideaId],
      subject: { kind: "initiative", id: initiative.id },
      payload: { from: initiative.status, to: input.status, note: input.note ?? "", on },
    });
    return updated!;
  });
  return (await initiativeDtos(ctx, [row]))[0]!;
}

/** Records what an initiative produced. Failures are recorded with the same care as successes. */
export async function recordOutcome(
  ctx: Ctx,
  initiativeId: string,
  input: RecordOutcomeRequest,
): Promise<InitiativeDto> {
  const row = await inTransaction(ctx, async (tx) => {
    const initiative = await findInitiative(tx, initiativeId);
    authorize(ctx.actor, "initiative.manage", {
      isCreator: initiative.createdBy === ctx.actor?.id,
      isSteward: (await currentStewardIds(tx.db, initiative.ideaId)).includes(ctx.actor?.id ?? ""),
    });
    if (initiative.status === "planned") {
      throw new DomainError("invariant_violated", "initiative_still_planned");
    }
    if (input.sourceId) {
      const [s] = await tx.db.select({ id: sources.id }).from(sources).where(eq(sources.id, input.sourceId));
      if (!s) throw new DomainError("validation_failed", "unknown_source");
    }
    const [outcome] = await tx.db
      .insert(outcomes)
      .values({
        initiativeId: initiative.id,
        result: input.result,
        summary: input.summary,
        lessons: input.lessons ?? "",
        sourceId: input.sourceId ?? null,
        recordedBy: ctx.actor!.id,
      })
      .returning();
    await recordActivity(tx, {
      action: "outcome.recorded",
      ideaIds: [initiative.ideaId],
      subject: { kind: "outcome", id: outcome!.id },
      payload: { initiativeId: initiative.id, result: input.result, hasLessons: !!input.lessons?.trim() },
    });
    return initiative;
  });
  return (await initiativeDtos(ctx, [await findInitiative(ctx, row.id)]))[0]!;
}

export async function listIdeaInitiatives(ctx: Ctx, ideaRef: string): Promise<InitiativeDto[]> {
  const idea = await findIdea(ctx, ideaRef);
  const rows = await ctx.db
    .select()
    .from(initiatives)
    .where(and(eq(initiatives.ideaId, idea.id), isModerator(ctx) ? undefined : isNull(initiatives.hiddenAt)))
    .orderBy(asc(initiatives.createdAt));
  return initiativeDtos(ctx, rows);
}

export async function getInitiative(ctx: Ctx, initiativeId: string): Promise<InitiativeDto> {
  const dto = (await initiativeDtos(ctx, [await findInitiative(ctx, initiativeId)]))[0];
  if (!dto) throw notFound("initiative_not_found");
  return dto;
}
