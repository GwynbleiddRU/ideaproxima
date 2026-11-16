import { and, asc, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import type {
  AddClaimRequest,
  ArgumentDto,
  AttachEvidenceRequest,
  ClaimDetailDto,
  ClaimDto,
  CreateArgumentRequest,
  EvidenceDto,
  IdeaClaimDto,
  SourceDto,
  SourceInput,
} from "@ideaproxima/contracts";
import {
  BASELINE_ALGORITHM,
  DomainError,
  EVIDENCE_STANCES,
  authorize,
  deriveClaimStatus,
  normalizeDoi,
  notFound,
  type EvidenceStance,
} from "@ideaproxima/domain";
import type { Database } from "../../db/client";
import {
  argumentsTable,
  claims,
  evidence,
  ideaClaims,
  ideas,
  initiatives,
  outcomes,
  sources,
} from "../../db/schema";
import { findIdea, isSteward } from "../ideas/queries";
import { refreshIdeaMetrics, summarizeTargets, usefulCounts } from "../metrics/service";
import { submitRatings } from "../signals/service";
import { recordActivity } from "../shared/activity";
import { inTransaction, isModerator, type Ctx } from "../shared/context";
import { lockKey } from "../shared/locks";
import { iso, isoOrNull, personRefs, ratingDto, refOrUnknown } from "../shared/refs";
import { ideasForArgument, ideasUsingClaim } from "../shared/targets";

type ClaimRow = typeof claims.$inferSelect;
type SourceRow = typeof sources.$inferSelect;
type EvidenceRow = typeof evidence.$inferSelect;
type ArgumentRow = typeof argumentsTable.$inferSelect;

// ---------------------------------------------------------------- helpers

async function findClaim(ctx: Ctx, claimId: string): Promise<ClaimRow> {
  const [claim] = await ctx.db.select().from(claims).where(eq(claims.id, claimId));
  if (!claim || (claim.hiddenAt && !isModerator(ctx))) throw notFound("Claim");
  return claim;
}

/** The ideas an argument target concerns. */
async function ideasForArgumentTarget(
  db: Database,
  target: { kind: "idea" | "claim" | "argument"; id: string },
): Promise<string[]> {
  if (target.kind === "idea") return [target.id];
  if (target.kind === "claim") return ideasUsingClaim(db, target.id);
  return ideasForArgument(db, target.id);
}

// ---------------------------------------------------------------- claim DTOs

async function claimDtos(ctx: Ctx, rows: ClaimRow[]): Promise<Map<string, ClaimDto>> {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return new Map();
  const [refs, summaries, evidenceRows, usage] = await Promise.all([
    personRefs(
      ctx.db,
      rows.map((r) => r.createdBy),
    ),
    summarizeTargets(ctx, ids, ["support", "plausibility"]),
    ctx.db
      .select({ claimId: evidence.claimId, stance: evidence.stance, n: sql<number>`count(*)::int` })
      .from(evidence)
      .where(and(inArray(evidence.claimId, ids), isNull(evidence.withdrawnAt), isNull(evidence.hiddenAt)))
      .groupBy(evidence.claimId, evidence.stance),
    ctx.db
      .select({ claimId: ideaClaims.claimId, n: sql<number>`count(distinct ${ideaClaims.ideaId})::int` })
      .from(ideaClaims)
      .where(and(inArray(ideaClaims.claimId, ids), isNull(ideaClaims.removedAt)))
      .groupBy(ideaClaims.claimId),
  ]);
  const usageMap = new Map(usage.map((u) => [u.claimId, u.n]));
  return new Map(
    rows.map((r) => {
      const s = summaries.get(r.id) ?? {};
      const counts = Object.fromEntries(EVIDENCE_STANCES.map((st) => [st, 0])) as Record<
        EvidenceStance,
        number
      >;
      for (const e of evidenceRows) if (e.claimId === r.id) counts[e.stance] = e.n;
      return [
        r.id,
        {
          id: r.id,
          statement: r.statement,
          createdBy: refOrUnknown(refs, r.createdBy),
          createdAt: iso(r.createdAt),
          hidden: !!r.hiddenAt,
          derived: {
            algorithm: BASELINE_ALGORITHM,
            status: deriveClaimStatus(s.support ?? null, s.plausibility ?? null),
            support: ratingDto(s.support),
            plausibility: ratingDto(s.plausibility),
          },
          evidenceCounts: counts,
          ideaCount: usageMap.get(r.id) ?? 0,
        },
      ];
    }),
  );
}

export async function listIdeaClaims(ctx: Ctx, ideaRef: string): Promise<IdeaClaimDto[]> {
  const idea = await findIdea(ctx, ideaRef);
  const links = await ctx.db
    .select({ link: ideaClaims, claim: claims })
    .from(ideaClaims)
    .innerJoin(claims, eq(claims.id, ideaClaims.claimId))
    .where(
      and(
        eq(ideaClaims.ideaId, idea.id),
        isNull(ideaClaims.removedAt),
        isModerator(ctx) ? undefined : isNull(claims.hiddenAt),
      ),
    )
    .orderBy(asc(ideaClaims.position), asc(ideaClaims.addedAt));
  const [dtos, refs] = await Promise.all([
    claimDtos(
      ctx,
      links.map((l) => l.claim),
    ),
    personRefs(
      ctx.db,
      links.map((l) => l.link.addedBy),
    ),
  ]);
  return links.map(({ link }) => ({
    ...dtos.get(link.claimId)!,
    linkId: link.id,
    role: link.role,
    depth: link.depth,
    position: link.position,
    addedBy: refOrUnknown(refs, link.addedBy),
    addedAt: iso(link.addedAt),
  }));
}

// ---------------------------------------------------------------- claims

/**
 * Adds a claim to an idea — either a new statement or an existing claim (claims are shared across ideas).
 * The contributor's own assessment, if given, is recorded as an ordinary evaluation: an author's opinion of
 * their own claim gets no special status.
 */
export async function addClaimToIdea(
  ctx: Ctx,
  ideaRef: string,
  input: AddClaimRequest,
): Promise<IdeaClaimDto> {
  authorize(ctx.actor, "knowledge.contribute");
  if (input.depth !== undefined && input.role !== "consequence" && input.role !== "risk") {
    throw new DomainError("validation_failed", "depth only applies to consequences and risks.");
  }
  const { ideaId, linkId } = await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    let claim: ClaimRow;
    if (input.claimId) {
      claim = await findClaim(tx, input.claimId);
    } else {
      [claim] = (await tx.db
        .insert(claims)
        .values({ statement: input.statement!.trim(), createdBy: ctx.actor!.id })
        .returning()) as [ClaimRow];
      await recordActivity(tx, {
        action: "claim.stated",
        ideaIds: [idea.id],
        subject: { kind: "claim", id: claim.id },
        payload: { statement: claim.statement },
      });
    }
    const [existing] = await tx.db
      .select({ id: ideaClaims.id })
      .from(ideaClaims)
      .where(
        and(
          eq(ideaClaims.ideaId, idea.id),
          eq(ideaClaims.claimId, claim.id),
          eq(ideaClaims.role, input.role),
          isNull(ideaClaims.removedAt),
        ),
      );
    if (existing) throw new DomainError("conflict", "This claim is already linked to the idea in that role.");
    const [{ p } = { p: 0 }] = await tx.db
      .select({ p: max(ideaClaims.position) })
      .from(ideaClaims)
      .where(eq(ideaClaims.ideaId, idea.id));
    const [link] = await tx.db
      .insert(ideaClaims)
      .values({
        ideaId: idea.id,
        claimId: claim.id,
        role: input.role,
        depth: input.depth ?? null,
        position: (p ?? -1) + 1,
        addedBy: ctx.actor!.id,
      })
      .returning();
    await recordActivity(tx, {
      action: "claim.linked",
      ideaIds: [idea.id],
      subject: { kind: "idea_claim", id: link!.id },
      payload: { claimId: claim.id, role: input.role },
    });
    const a = input.assessment;
    const ratings = [
      ...(a?.support ? [{ dimension: "support", value: a.support, confidence: a.confidence }] : []),
      ...(a?.plausibility
        ? [{ dimension: "plausibility", value: a.plausibility, confidence: a.confidence }]
        : []),
    ];
    if (ratings.length) await submitRatings(tx, { kind: "claim", id: claim.id }, ratings, "");
    await refreshIdeaMetrics(tx, [idea.id]);
    return { ideaId: idea.id, linkId: link!.id };
  });
  const all = await listIdeaClaims(ctx, ideaId);
  return all.find((c) => c.linkId === linkId)!;
}

export async function unlinkClaim(ctx: Ctx, ideaRef: string, linkId: string): Promise<void> {
  await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    const [link] = await tx.db
      .select()
      .from(ideaClaims)
      .where(and(eq(ideaClaims.id, linkId), eq(ideaClaims.ideaId, idea.id), isNull(ideaClaims.removedAt)));
    if (!link) throw notFound("Claim link");
    authorize(ctx.actor, "structure.curate", {
      isCreator: link.addedBy === ctx.actor?.id,
      isSteward: await isSteward(tx, idea.id),
    });
    await tx.db
      .update(ideaClaims)
      .set({ removedAt: sql`now()`, removedBy: ctx.actor!.id })
      .where(eq(ideaClaims.id, link.id));
    await recordActivity(tx, {
      action: "claim.unlinked",
      ideaIds: [idea.id],
      subject: { kind: "idea_claim", id: link.id },
      payload: { claimId: link.claimId, role: link.role },
    });
    await refreshIdeaMetrics(tx, [idea.id]);
  });
}

export async function getClaim(ctx: Ctx, claimId: string): Promise<ClaimDetailDto> {
  const claim = await findClaim(ctx, claimId);
  const [dtoMap, ideaLinks, evidenceRows, argumentRows] = await Promise.all([
    claimDtos(ctx, [claim]),
    ctx.db
      .select({
        id: ideas.id,
        slug: ideas.slug,
        title: ideas.title,
        stage: ideas.stage,
        role: ideaClaims.role,
      })
      .from(ideaClaims)
      .innerJoin(ideas, eq(ideas.id, ideaClaims.ideaId))
      .where(and(eq(ideaClaims.claimId, claim.id), isNull(ideaClaims.removedAt), isNull(ideas.hiddenAt))),
    ctx.db
      .select()
      .from(evidence)
      .where(and(eq(evidence.claimId, claim.id), isModerator(ctx) ? undefined : isNull(evidence.hiddenAt)))
      .orderBy(asc(evidence.createdAt)),
    ctx.db
      .select()
      .from(argumentsTable)
      .where(
        and(
          eq(argumentsTable.claimId, claim.id),
          isModerator(ctx) ? undefined : isNull(argumentsTable.hiddenAt),
        ),
      )
      .orderBy(asc(argumentsTable.createdAt)),
  ]);
  return {
    ...dtoMap.get(claim.id)!,
    ideas: ideaLinks,
    evidence: await evidenceDtos(ctx, evidenceRows),
    arguments: await argumentDtos(ctx, argumentRows),
  };
}

/**
 * Claims matching a full-text query, with their derived status and how many ideas they underpin — computed by
 * `claimDtos`, the same derivation every other claim view uses.
 */
export async function searchClaims(ctx: Ctx, q: string, limit: number) {
  const rows = await ctx.db
    .select()
    .from(claims)
    .where(and(isNull(claims.hiddenAt), sql`${claims.search} @@ websearch_to_tsquery('english', ${q})`))
    .orderBy(desc(sql`ts_rank(${claims.search}, websearch_to_tsquery('english', ${q}))`))
    .limit(limit);
  const dtos = await claimDtos(ctx, rows);
  return rows.map((r) => {
    const c = dtos.get(r.id)!;
    return { id: c.id, statement: c.statement, ideaCount: c.ideaCount, status: c.derived.status };
  });
}

// ---------------------------------------------------------------- sources

export const sourceDto = (s: SourceRow, refs: Awaited<ReturnType<typeof personRefs>>): SourceDto => ({
  id: s.id,
  kind: s.kind,
  title: s.title,
  authors: s.authors,
  venue: s.venue,
  year: s.publishedYear,
  doi: s.doi,
  url: s.url,
  registeredBy: refOrUnknown(refs, s.registeredBy),
  createdAt: iso(s.createdAt),
});

/**
 * Registers a source, or returns the existing one with the same DOI (or exact URL). Idempotent, so clients can
 * always "register" before citing without creating duplicates.
 */
export async function registerSource(
  ctx: Ctx,
  input: SourceInput,
): Promise<{ source: SourceDto; created: boolean }> {
  authorize(ctx.actor, "knowledge.contribute");
  return inTransaction(ctx, async (tx) => {
    let doi: string | null = null;
    if (input.doi) {
      doi = normalizeDoi(input.doi);
      if (!doi)
        throw new DomainError("validation_failed", "That does not look like a DOI (expected 10.xxxx/…).");
    }
    // "Find or create" must stay idempotent when two people cite the same publication at the same moment.
    if (doi) await lockKey(tx, "source:doi", doi);
    else if (input.url) await lockKey(tx, "source:url", input.url);
    const [existing] = doi
      ? await tx.db.select().from(sources).where(eq(sources.doi, doi))
      : input.url
        ? await tx.db.select().from(sources).where(eq(sources.url, input.url))
        : [];
    if (existing)
      return {
        source: sourceDto(existing, await personRefs(tx.db, [existing.registeredBy])),
        created: false,
      };
    const [row] = await tx.db
      .insert(sources)
      .values({
        kind: input.kind,
        title: input.title,
        authors: input.authors ?? "",
        venue: input.venue ?? "",
        publishedYear: input.year ?? null,
        doi,
        url: input.url ?? null,
        registeredBy: ctx.actor!.id,
      })
      .returning();
    await recordActivity(tx, {
      action: "source.registered",
      subject: { kind: "source", id: row!.id },
      payload: { title: row!.title },
    });
    return { source: sourceDto(row!, await personRefs(tx.db, [row!.registeredBy])), created: true };
  });
}

export async function getSource(ctx: Ctx, sourceId: string): Promise<SourceDto & { citedBy: number }> {
  const [row] = await ctx.db.select().from(sources).where(eq(sources.id, sourceId));
  if (!row) throw notFound("Source");
  const [{ n } = { n: 0 }] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(evidence)
    .where(and(eq(evidence.sourceId, sourceId), isNull(evidence.withdrawnAt), isNull(evidence.hiddenAt)));
  return { ...sourceDto(row, await personRefs(ctx.db, [row.registeredBy])), citedBy: n };
}

export async function searchSources(db: Database, q: string, limit: number) {
  const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const rows = await db
    .select()
    .from(sources)
    .where(sql`(${sources.title} ilike ${pattern} or ${sources.doi} = ${q.toLowerCase()})`)
    .limit(limit);
  const refs = await personRefs(
    db,
    rows.map((r) => r.registeredBy),
  );
  return rows.map((r) => sourceDto(r, refs));
}

// ---------------------------------------------------------------- evidence

export async function evidenceDtos(ctx: Ctx, rows: EvidenceRow[]): Promise<EvidenceDto[]> {
  if (!rows.length) return [];
  const sourceIds = rows.map((r) => r.sourceId).filter((x): x is string => !!x);
  const outcomeIds = rows.map((r) => r.outcomeId).filter((x): x is string => !!x);
  const [sourceRows, outcomeRows, summaries] = await Promise.all([
    sourceIds.length ? ctx.db.select().from(sources).where(inArray(sources.id, sourceIds)) : [],
    outcomeIds.length
      ? ctx.db
          .select({ id: outcomes.id, initiativeId: outcomes.initiativeId, result: outcomes.result })
          .from(outcomes)
          .where(inArray(outcomes.id, outcomeIds))
      : [],
    summarizeTargets(
      ctx,
      rows.map((r) => r.id),
      ["quality", "relevance"],
    ),
  ]);
  const refs = await personRefs(ctx.db, [
    ...rows.map((r) => r.contributedBy),
    ...sourceRows.map((s) => s.registeredBy),
  ]);
  const sourceMap = new Map(sourceRows.map((s) => [s.id, sourceDto(s, refs)]));
  const outcomeMap = new Map(outcomeRows.map((o) => [o.id, o]));
  return rows.map((r) => {
    const s = summaries.get(r.id) ?? {};
    return {
      id: r.id,
      claimId: r.claimId,
      stance: r.stance,
      summary: r.hiddenAt && !isModerator(ctx) ? "" : r.summary,
      limitations: r.limitations,
      locator: r.locator,
      source: r.sourceId ? (sourceMap.get(r.sourceId) ?? null) : null,
      outcome: r.outcomeId ? (outcomeMap.get(r.outcomeId) ?? null) : null,
      contributedBy: refOrUnknown(refs, r.contributedBy),
      createdAt: iso(r.createdAt),
      withdrawnAt: isoOrNull(r.withdrawnAt),
      withdrawnReason: r.withdrawnReason,
      hidden: !!r.hiddenAt,
      derived: {
        algorithm: BASELINE_ALGORITHM,
        quality: ratingDto(s.quality),
        relevance: ratingDto(s.relevance),
      },
    };
  });
}

/**
 * Attaches evidence to a claim. The basis is exactly one of: an existing source, a new source (registered or
 * deduplicated on the fly), or an outcome recorded on the platform (failed experiments are evidence too).
 */
export async function attachEvidence(
  ctx: Ctx,
  claimId: string,
  input: AttachEvidenceRequest,
): Promise<EvidenceDto> {
  authorize(ctx.actor, "knowledge.contribute");
  const row = await inTransaction(ctx, async (tx) => {
    const claim = await findClaim(tx, claimId);
    let sourceId: string | null = null;
    let outcomeId: string | null = null;
    if (input.source) sourceId = (await registerSource(tx, input.source)).source.id;
    else if (input.sourceId) {
      const [s] = await tx.db.select({ id: sources.id }).from(sources).where(eq(sources.id, input.sourceId));
      if (!s) throw new DomainError("validation_failed", "Unknown sourceId.");
      sourceId = s.id;
    } else if (input.outcomeId) {
      const [o] = await tx.db
        .select({ id: outcomes.id })
        .from(outcomes)
        .innerJoin(initiatives, eq(initiatives.id, outcomes.initiativeId))
        .where(and(eq(outcomes.id, input.outcomeId), isNull(initiatives.hiddenAt)));
      if (!o) throw new DomainError("validation_failed", "Unknown outcomeId.");
      outcomeId = o.id;
    }
    const [dup] = await tx.db
      .select({ id: evidence.id })
      .from(evidence)
      .where(
        and(
          eq(evidence.claimId, claim.id),
          isNull(evidence.withdrawnAt),
          sourceId ? eq(evidence.sourceId, sourceId) : eq(evidence.outcomeId, outcomeId!),
        ),
      );
    if (dup)
      throw new DomainError(
        "conflict",
        "This source is already attached to the claim. Assess or discuss it instead.",
      );
    const [created] = await tx.db
      .insert(evidence)
      .values({
        claimId: claim.id,
        sourceId,
        outcomeId,
        stance: input.stance,
        summary: input.summary,
        limitations: input.limitations ?? "",
        locator: input.locator ?? "",
        contributedBy: ctx.actor!.id,
      })
      .returning();
    const ideaIds = await ideasUsingClaim(tx.db, claim.id);
    await recordActivity(tx, {
      action: "evidence.attached",
      ideaIds,
      subject: { kind: "evidence", id: created!.id },
      payload: { claimId: claim.id, stance: input.stance, sourceId, outcomeId },
    });
    await refreshIdeaMetrics(tx, ideaIds);
    return created!;
  });
  return (await evidenceDtos(ctx, [row]))[0]!;
}

export async function withdrawEvidence(ctx: Ctx, evidenceId: string, reason: string): Promise<EvidenceDto> {
  const row = await inTransaction(ctx, async (tx) => {
    const [ev] = await tx.db.select().from(evidence).where(eq(evidence.id, evidenceId));
    if (!ev) throw notFound("Evidence");
    authorize(ctx.actor, "contribution.withdraw", { isCreator: ev.contributedBy === ctx.actor?.id });
    if (ev.withdrawnAt) throw new DomainError("invariant_violated", "Already withdrawn.");
    const [updated] = await tx.db
      .update(evidence)
      .set({ withdrawnAt: sql`now()`, withdrawnReason: reason })
      .where(eq(evidence.id, ev.id))
      .returning();
    const ideaIds = await ideasUsingClaim(tx.db, ev.claimId);
    await recordActivity(tx, {
      action: "evidence.withdrawn",
      ideaIds,
      subject: { kind: "evidence", id: ev.id },
      payload: { claimId: ev.claimId, reason },
    });
    await refreshIdeaMetrics(tx, ideaIds);
    return updated!;
  });
  return (await evidenceDtos(ctx, [row]))[0]!;
}

// ---------------------------------------------------------------- arguments

const argumentTarget = (r: ArgumentRow): ArgumentDto["target"] =>
  r.ideaId
    ? { kind: "idea", id: r.ideaId }
    : r.claimId
      ? { kind: "claim", id: r.claimId }
      : { kind: "argument", id: r.parentArgumentId! };

export async function argumentDtos(ctx: Ctx, rows: ArgumentRow[]): Promise<ArgumentDto[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [refs, summaries, useful, replies] = await Promise.all([
    personRefs(
      ctx.db,
      rows.map((r) => r.authorId),
    ),
    summarizeTargets(ctx, ids, ["strength"]),
    usefulCounts(ctx.db, ids),
    ctx.db
      .select({ parent: argumentsTable.parentArgumentId, n: sql<number>`count(*)::int` })
      .from(argumentsTable)
      .where(and(inArray(argumentsTable.parentArgumentId, ids), isNull(argumentsTable.hiddenAt)))
      .groupBy(argumentsTable.parentArgumentId),
  ]);
  const replyMap = new Map(replies.map((r) => [r.parent!, r.n]));
  const redact = (r: ArgumentRow) => !!r.hiddenAt && !isModerator(ctx);
  return rows.map((r) => ({
    id: r.id,
    target: argumentTarget(r),
    stance: r.stance,
    title: redact(r) ? "" : r.title,
    body: redact(r) ? "" : r.body,
    author: refOrUnknown(refs, r.authorId),
    createdAt: iso(r.createdAt),
    withdrawnAt: isoOrNull(r.withdrawnAt),
    hidden: !!r.hiddenAt,
    replyCount: replyMap.get(r.id) ?? 0,
    derived: {
      algorithm: BASELINE_ALGORITHM,
      strength: ratingDto(summaries.get(r.id)?.strength),
      usefulCount: useful.get(r.id) ?? 0,
    },
  }));
}

export async function createArgument(ctx: Ctx, input: CreateArgumentRequest): Promise<ArgumentDto> {
  authorize(ctx.actor, "knowledge.contribute");
  const row = await inTransaction(ctx, async (tx) => {
    const t = input.target;
    if (t.kind === "idea") await findIdea(tx, t.id);
    else if (t.kind === "claim") await findClaim(tx, t.id);
    else {
      const [parent] = await tx.db.select().from(argumentsTable).where(eq(argumentsTable.id, t.id));
      if (!parent || (parent.hiddenAt && !isModerator(tx))) throw notFound("Argument");
    }
    const [created] = await tx.db
      .insert(argumentsTable)
      .values({
        ideaId: t.kind === "idea" ? t.id : null,
        claimId: t.kind === "claim" ? t.id : null,
        parentArgumentId: t.kind === "argument" ? t.id : null,
        stance: input.stance,
        title: input.title,
        body: input.body,
        authorId: ctx.actor!.id,
      })
      .returning();
    const ideaIds = await ideasForArgumentTarget(tx.db, t);
    await recordActivity(tx, {
      action: "argument.made",
      ideaIds,
      subject: { kind: "argument", id: created!.id },
      payload: { target: t, stance: input.stance, title: input.title },
    });
    await refreshIdeaMetrics(tx, ideaIds);
    return created!;
  });
  return (await argumentDtos(ctx, [row]))[0]!;
}

export async function withdrawArgument(ctx: Ctx, argumentId: string): Promise<ArgumentDto> {
  const row = await inTransaction(ctx, async (tx) => {
    const [arg] = await tx.db.select().from(argumentsTable).where(eq(argumentsTable.id, argumentId));
    if (!arg) throw notFound("Argument");
    authorize(ctx.actor, "contribution.withdraw", { isCreator: arg.authorId === ctx.actor?.id });
    if (arg.withdrawnAt) throw new DomainError("invariant_violated", "Already withdrawn.");
    const [updated] = await tx.db
      .update(argumentsTable)
      .set({ withdrawnAt: sql`now()` })
      .where(eq(argumentsTable.id, arg.id))
      .returning();
    const ideaIds = await ideasForArgumentTarget(tx.db, argumentTarget(arg));
    await recordActivity(tx, {
      action: "argument.withdrawn",
      ideaIds,
      subject: { kind: "argument", id: arg.id },
    });
    await refreshIdeaMetrics(tx, ideaIds);
    return updated!;
  });
  return (await argumentDtos(ctx, [row]))[0]!;
}

export async function listIdeaArguments(ctx: Ctx, ideaRef: string): Promise<ArgumentDto[]> {
  const idea = await findIdea(ctx, ideaRef);
  const rows = await ctx.db
    .select()
    .from(argumentsTable)
    .where(
      and(eq(argumentsTable.ideaId, idea.id), isModerator(ctx) ? undefined : isNull(argumentsTable.hiddenAt)),
    )
    .orderBy(asc(argumentsTable.createdAt));
  return argumentDtos(ctx, rows);
}

export async function getArgument(
  ctx: Ctx,
  argumentId: string,
): Promise<ArgumentDto & { replies: ArgumentDto[] }> {
  const [row] = await ctx.db.select().from(argumentsTable).where(eq(argumentsTable.id, argumentId));
  if (!row || (row.hiddenAt && !isModerator(ctx))) throw notFound("Argument");
  const replies = await ctx.db
    .select()
    .from(argumentsTable)
    .where(
      and(
        eq(argumentsTable.parentArgumentId, row.id),
        isModerator(ctx) ? undefined : isNull(argumentsTable.hiddenAt),
      ),
    )
    .orderBy(asc(argumentsTable.createdAt));
  return { ...(await argumentDtos(ctx, [row]))[0]!, replies: await argumentDtos(ctx, replies) };
}
