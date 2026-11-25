import { and, eq, inArray, isNull, like, max, or, sql } from "drizzle-orm";
import type {
  AppointStewardRequest,
  DecideRevisionRequest,
  IdeaContentInput,
  IdeaDetail,
  RevisionDto,
  StageTransitionDto,
  StageTransitionRequest,
  StewardDto,
  SubmitRevisionRequest,
} from "@ideaproxima/contracts";
import {
  DomainError,
  assertStageTransition,
  authorize,
  normalizeIdeaContent,
  notFound,
  sameIdeaContent,
  slugify,
  type IdeaContent,
} from "@ideaproxima/domain";
import type { Database } from "../../db/client";
import {
  ideaRevisions,
  ideaStewards,
  ideaTopics,
  ideas,
  initiatives,
  people,
  stageTransitions,
  topics,
} from "../../db/schema";
import { refreshIdeaMetrics } from "../metrics/service";
import { recordActivity } from "../shared/activity";
import { inTransaction, type Ctx } from "../shared/context";
import { lockKey } from "../shared/locks";
import { iso, personRefs, refOrUnknown } from "../shared/refs";
import {
  currentStewardIds,
  findIdea,
  gatherStageFacts,
  getIdeaDetail,
  lockIdea,
  revisionDtos,
  stageTransitionDto,
} from "./queries";

/** Resolves topic slugs to ids, preserving order (first = primary topic). */
async function resolveTopicIds(db: Database, slugs: readonly string[]): Promise<string[]> {
  const rows = await db
    .select({ id: topics.id, slug: topics.slug })
    .from(topics)
    .where(inArray(topics.slug, [...slugs]));
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const missing = slugs.filter((s) => !bySlug.has(s));
  if (missing.length)
    throw new DomainError("validation_failed", "unknown_idea_topics", { topics: missing.join(", ") });
  return slugs.map((s) => bySlug.get(s)!);
}

async function uniqueSlug(db: Database, title: string): Promise<string> {
  const base = slugify(title);
  const rows = await db
    .select({ slug: ideas.slug })
    .from(ideas)
    .where(or(eq(ideas.slug, base), like(ideas.slug, `${base}-%`)));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * Makes a revision current: updates the idea's content projection and topic links. The revision itself is the
 * fact; this function only keeps the projection in sync, inside the caller's transaction.
 */
async function applyRevision(
  db: Database,
  ideaId: string,
  revisionId: string,
  content: IdeaContent,
  topicIds: string[],
) {
  await db
    .update(ideas)
    .set({
      currentRevisionId: revisionId,
      title: content.title,
      summary: content.summary,
      tags: content.tags,
      updatedAt: sql`now()`,
    })
    .where(eq(ideas.id, ideaId));
  await db.delete(ideaTopics).where(eq(ideaTopics.ideaId, ideaId));
  await db.insert(ideaTopics).values(topicIds.map((topicId, position) => ({ ideaId, topicId, position })));
}

const toContent = (input: IdeaContentInput): IdeaContent =>
  normalizeIdeaContent({
    title: input.title,
    summary: input.summary,
    sections: input.sections ?? {},
    topics: input.topics,
    tags: input.tags ?? [],
  });

// ---------------------------------------------------------------- propose

/**
 * Proposing an idea records four facts at once: the idea's identity, its first revision, its originator as
 * steward, and its entry into the lifecycle ("imagined"). An idea need not be feasible or proven to be preserved.
 */
export async function proposeIdea(ctx: Ctx, input: IdeaContentInput): Promise<IdeaDetail> {
  authorize(ctx.actor, "idea.propose");
  const actorId = ctx.actor.id;
  const content = toContent(input);
  const ideaId = await inTransaction(ctx, async (tx) => {
    const topicIds = await resolveTopicIds(tx.db, content.topics);
    // Two ideas with the same title proposed at once must get distinct slugs, not a unique-violation error.
    await lockKey(tx, "idea-slug", slugify(content.title));
    const [idea] = await tx.db
      .insert(ideas)
      .values({
        slug: await uniqueSlug(tx.db, content.title),
        proposedBy: actorId,
        title: content.title,
        summary: content.summary,
        tags: content.tags,
        stage: "imagined",
      })
      .returning();
    const [revision] = await tx.db
      .insert(ideaRevisions)
      .values({
        ideaId: idea!.id,
        number: 1,
        authorId: actorId,
        changeNote: "Initial proposal.",
        content,
        status: "accepted",
        decidedBy: actorId,
        decidedAt: sql`now()`,
      })
      .returning();
    await applyRevision(tx.db, idea!.id, revision!.id, content, topicIds);
    await tx.db.insert(ideaStewards).values({ ideaId: idea!.id, personId: actorId, role: "originator" });
    await tx.db.insert(stageTransitions).values({
      ideaId: idea!.id,
      fromStage: null,
      toStage: "imagined",
      rationale: "Idea proposed.",
      decidedBy: actorId,
    });
    await recordActivity(tx, {
      action: "idea.proposed",
      ideaIds: [idea!.id],
      subject: { kind: "idea", id: idea!.id },
      payload: { revisionId: revision!.id, title: content.title },
    });
    await refreshIdeaMetrics(tx, [idea!.id]);
    return idea!.id;
  });
  return getIdeaDetail(ctx, ideaId);
}

// ---------------------------------------------------------------- revisions

/**
 * Submits a new version of an idea's narrative.
 *  - Stewards publish directly (intent "auto" or "publish"); everyone else proposes for stewards to decide.
 *  - Optimistic concurrency: publishing requires `baseRevisionId` to be the current revision, so two editors
 *    can never silently overwrite each other.
 *  - A revision identical to the current content is rejected: history should not fill with no-ops.
 */
export async function submitRevision(
  ctx: Ctx,
  ideaRef: string,
  input: SubmitRevisionRequest,
): Promise<RevisionDto> {
  authorize(ctx.actor, "idea.revision.propose");
  const content = toContent(input.content);
  const { ideaId, revisionId } = await inTransaction(ctx, async (tx) => {
    const found = await findIdea(tx, ideaRef);
    const idea = await lockIdea(tx, found.id);
    const steward = (await currentStewardIds(tx.db, idea.id)).includes(ctx.actor!.id);
    const publish = input.intent === "publish" || (input.intent === "auto" && steward);
    if (publish) authorize(ctx.actor, "idea.revise", { isSteward: steward });

    const [base] = await tx.db
      .select()
      .from(ideaRevisions)
      .where(and(eq(ideaRevisions.id, input.baseRevisionId), eq(ideaRevisions.ideaId, idea.id)));
    if (!base) throw new DomainError("validation_failed", "revision_wrong_idea");
    const [current] = await tx.db
      .select()
      .from(ideaRevisions)
      .where(eq(ideaRevisions.id, idea.currentRevisionId!));
    if (publish && base.id !== current!.id) {
      throw new DomainError(
        "conflict",
        "revision_base_changed",
        { number: current!.number },
        {
          currentRevisionId: current!.id,
        },
      );
    }
    if (sameIdeaContent(content, current!.content)) {
      throw new DomainError("validation_failed", "revision_unchanged");
    }
    const topicIds = await resolveTopicIds(tx.db, content.topics);
    const [{ n } = { n: 0 }] = await tx.db
      .select({ n: max(ideaRevisions.number) })
      .from(ideaRevisions)
      .where(eq(ideaRevisions.ideaId, idea.id));
    const [revision] = await tx.db
      .insert(ideaRevisions)
      .values({
        ideaId: idea.id,
        number: (n ?? 0) + 1,
        baseRevisionId: base.id,
        authorId: ctx.actor!.id,
        changeNote: input.changeNote,
        content,
        status: publish ? "accepted" : "proposed",
        decidedBy: publish ? ctx.actor!.id : null,
        decidedAt: publish ? sql`now()` : null,
      })
      .returning();
    if (publish) {
      await applyRevision(tx.db, idea.id, revision!.id, content, topicIds);
      await refreshIdeaMetrics(tx, [idea.id]);
    }
    await recordActivity(tx, {
      action: publish ? "revision.published" : "revision.proposed",
      ideaIds: [idea.id],
      subject: { kind: "revision", id: revision!.id },
      payload: { number: revision!.number, changeNote: input.changeNote },
    });
    return { ideaId: idea.id, revisionId: revision!.id };
  });
  return getRevisionDto(ctx.db, ideaId, revisionId);
}

async function getRevisionDto(db: Database, ideaId: string, revisionId: string): Promise<RevisionDto> {
  const rows = await db
    .select()
    .from(ideaRevisions)
    .where(and(eq(ideaRevisions.id, revisionId), eq(ideaRevisions.ideaId, ideaId)));
  if (!rows.length) throw notFound("revision_not_found");
  return (await revisionDtos(db, rows))[0]!;
}

/**
 * Accepts or rejects a proposed revision. Accepting requires the proposal to be based on the current revision —
 * otherwise accepting it would silently discard the changes made in between.
 */
export async function decideRevision(
  ctx: Ctx,
  ideaRef: string,
  revisionId: string,
  input: DecideRevisionRequest,
): Promise<RevisionDto> {
  const ideaId = await inTransaction(ctx, async (tx) => {
    const found = await findIdea(tx, ideaRef);
    const idea = await lockIdea(tx, found.id);
    authorize(ctx.actor, "idea.revision.decide", {
      isSteward: (await currentStewardIds(tx.db, idea.id)).includes(ctx.actor?.id ?? ""),
    });
    const [revision] = await tx.db
      .select()
      .from(ideaRevisions)
      .where(and(eq(ideaRevisions.id, revisionId), eq(ideaRevisions.ideaId, idea.id)));
    if (!revision) throw notFound("revision_not_found");
    if (revision.status !== "proposed") {
      throw new DomainError("invariant_violated", "revision_already_reviewed", { status: revision.status });
    }
    const accept = input.decision === "accept";
    if (accept && revision.baseRevisionId !== idea.currentRevisionId) {
      throw new DomainError("conflict", "proposal_base_changed", undefined, {
        currentRevisionId: idea.currentRevisionId,
      });
    }
    await tx.db
      .update(ideaRevisions)
      .set({
        status: accept ? "accepted" : "rejected",
        decidedBy: ctx.actor!.id,
        decidedAt: sql`now()`,
        decisionNote: input.note ?? "",
      })
      .where(eq(ideaRevisions.id, revision.id));
    if (accept) {
      await applyRevision(
        tx.db,
        idea.id,
        revision.id,
        revision.content,
        await resolveTopicIds(tx.db, revision.content.topics),
      );
      await refreshIdeaMetrics(tx, [idea.id]);
    }
    await recordActivity(tx, {
      action: accept ? "revision.accepted" : "revision.rejected",
      ideaIds: [idea.id],
      subject: { kind: "revision", id: revision.id },
      payload: { number: revision.number, authorId: revision.authorId, note: input.note ?? "" },
    });
    return idea.id;
  });
  return getRevisionDto(ctx.db, ideaId, revisionId);
}

export async function withdrawRevision(ctx: Ctx, ideaRef: string, revisionId: string): Promise<RevisionDto> {
  const ideaId = await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    const [revision] = await tx.db
      .select()
      .from(ideaRevisions)
      .where(and(eq(ideaRevisions.id, revisionId), eq(ideaRevisions.ideaId, idea.id)));
    if (!revision) throw notFound("revision_not_found");
    authorize(ctx.actor, "contribution.withdraw", { isCreator: revision.authorId === ctx.actor?.id });
    if (revision.status !== "proposed") throw new DomainError("invariant_violated", "proposal_not_pending");
    await tx.db
      .update(ideaRevisions)
      .set({ status: "withdrawn", decidedBy: ctx.actor!.id, decidedAt: sql`now()` })
      .where(eq(ideaRevisions.id, revision.id));
    await recordActivity(tx, {
      action: "revision.withdrawn",
      ideaIds: [idea.id],
      subject: { kind: "revision", id: revision.id },
      payload: { number: revision.number },
    });
    return idea.id;
  });
  return getRevisionDto(ctx.db, ideaId, revisionId);
}

// ---------------------------------------------------------------- stewardship

export async function appointSteward(
  ctx: Ctx,
  ideaRef: string,
  input: AppointStewardRequest,
): Promise<StewardDto[]> {
  return inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    const stewardIds = await currentStewardIds(tx.db, idea.id);
    authorize(ctx.actor, "idea.steward.appoint", { isSteward: stewardIds.includes(ctx.actor?.id ?? "") });
    const [person] = await tx.db.select().from(people).where(eq(people.handle, input.handle));
    if (!person || person.deactivatedAt) throw notFound("person_not_found");
    if (stewardIds.includes(person.id)) throw new DomainError("conflict", "already_steward");
    const [row] = await tx.db
      .insert(ideaStewards)
      .values({ ideaId: idea.id, personId: person.id, role: "steward", grantedBy: ctx.actor!.id })
      .returning();
    await recordActivity(tx, {
      action: "steward.appointed",
      ideaIds: [idea.id],
      subject: { kind: "steward", id: row!.id },
      payload: { personId: person.id },
    });
    const rows = await tx.db
      .select()
      .from(ideaStewards)
      .where(and(eq(ideaStewards.ideaId, idea.id), isNull(ideaStewards.revokedAt)));
    const refs = await personRefs(
      tx.db,
      rows.map((r) => r.personId),
    );
    return rows.map((r) => ({
      person: refOrUnknown(refs, r.personId),
      role: r.role,
      since: iso(r.grantedAt),
    }));
  });
}

// ---------------------------------------------------------------- lifecycle

/**
 * Records a lifecycle transition. Later stages must be backed by recorded facts (initiatives and outcomes) —
 * see `assertStageTransition` in @ideaproxima/domain for the exact rules.
 */
export async function transitionStage(
  ctx: Ctx,
  ideaRef: string,
  input: StageTransitionRequest,
): Promise<StageTransitionDto> {
  return inTransaction(ctx, async (tx) => {
    const found = await findIdea(tx, ideaRef);
    const idea = await lockIdea(tx, found.id);
    authorize(ctx.actor, "idea.stage.transition", {
      isSteward: (await currentStewardIds(tx.db, idea.id)).includes(ctx.actor?.id ?? ""),
    });
    if (input.initiativeId) {
      const [initiative] = await tx.db
        .select({ id: initiatives.id })
        .from(initiatives)
        .where(and(eq(initiatives.id, input.initiativeId), eq(initiatives.ideaId, idea.id)));
      if (!initiative) throw new DomainError("validation_failed", "initiative_wrong_idea");
    }
    assertStageTransition({
      from: idea.stage,
      to: input.to,
      rationale: input.rationale,
      facts: await gatherStageFacts(tx.db, idea.id),
    });
    const [row] = await tx.db
      .insert(stageTransitions)
      .values({
        ideaId: idea.id,
        fromStage: idea.stage,
        toStage: input.to,
        rationale: input.rationale.trim(),
        decidedBy: ctx.actor!.id,
        initiativeId: input.initiativeId ?? null,
      })
      .returning();
    await tx.db
      .update(ideas)
      .set({ stage: input.to, stageChangedAt: row!.occurredAt })
      .where(eq(ideas.id, idea.id));
    await recordActivity(tx, {
      action: "stage.changed",
      ideaIds: [idea.id],
      subject: { kind: "stage_transition", id: row!.id },
      payload: { from: idea.stage, to: input.to },
    });
    return stageTransitionDto(row!, await personRefs(tx.db, [row!.decidedBy]));
  });
}
