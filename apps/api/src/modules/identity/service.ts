import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type {
  AuthResponse,
  ChangePasswordRequest,
  DeclareExpertiseRequest,
  ExpertiseDto,
  LoginRequest,
  MeResponse,
  PersonDto,
  ProfileDto,
  RegisterRequest,
  UpdateProfileRequest,
} from "@ideaproxima/contracts";
import type { PersonRole } from "@ideaproxima/domain";
import { isLocale, type Locale } from "@ideaproxima/i18n";
import { DomainError, authorize, isValidHandle, notFound, trustTier, type Actor } from "@ideaproxima/domain";
import { queryRows, type Database } from "../../db/client";
import { accounts, ideas, involvements, people, personExpertise, sessions, topics } from "../../db/schema";
import { recordActivity } from "../shared/activity";
import { inTransaction, type Ctx } from "../shared/context";
import { requireLocale } from "../shared/locales";
import { ideaRefs, iso } from "../shared/refs";
import { listIdeaItems } from "../ideas/queries";
import { hashPassword, hashToken, newSessionToken, verifyPassword } from "./crypto";

type PersonRow = typeof people.$inferSelect;

export const personDto = (p: PersonRow): PersonDto => ({
  id: p.id,
  handle: p.handle,
  displayName: p.displayName,
  bio: p.bio,
  affiliation: p.affiliation,
  capacities: p.capacities,
  role: p.role,
  active: !p.deactivatedAt,
  createdAt: iso(p.createdAt),
});

// ---------------------------------------------------------------- sessions

export async function createSession(db: Database, personId: string, ttlDays: number) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.insert(sessions).values({ personId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** Resolves a session token to an Actor. Expired, revoked and deactivated sessions resolve to null. */
export async function resolveSession(
  db: Database,
  token: string,
  requireVerifiedEmail = false,
): Promise<{ actor: Actor; sessionId: string; locale: Locale | null } | null> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      id: people.id,
      role: people.role,
      deactivatedAt: people.deactivatedAt,
      createdAt: sql<Date>`coalesce(${accounts.createdAt}, ${people.createdAt})`.mapWith(accounts.createdAt),
      emailVerifiedAt: accounts.emailVerifiedAt,
      locale: accounts.locale,
    })
    .from(sessions)
    .innerJoin(people, eq(people.id, sessions.personId))
    .leftJoin(accounts, eq(accounts.personId, sessions.personId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  if (!row || row.deactivatedAt) return null;
  return {
    sessionId: row.sessionId,
    actor: {
      id: row.id,
      role: row.role,
      active: true,
      trust: trustTier(
        { ...row, establishedAt: null, restrictedUntil: null },
        new Date(),
        requireVerifiedEmail,
      ),
    },
    locale: savedLocale(row.locale),
  };
}

/** Revokes every session of a person, optionally keeping one (the caller's own). */
async function revokeAllSessions(
  db: Database,
  personId: string,
  keepSessionId?: string | null,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(sessions.personId, personId),
        isNull(sessions.revokedAt),
        keepSessionId ? sql`${sessions.id} <> ${keepSessionId}` : undefined,
      ),
    );
}

/**
 * Changes the caller's password after verifying the current one, and signs out every other session (a password
 * change is usually a response to suspected compromise). Not written to the public ledger: it is a security
 * event, not a contribution.
 */
export async function changePassword(
  ctx: Ctx,
  currentSessionId: string | null,
  input: ChangePasswordRequest,
): Promise<void> {
  if (!ctx.actor) throw new DomainError("unauthenticated", "sign_in_required");
  const actorId = ctx.actor.id;
  const [account] = await ctx.db.select().from(accounts).where(eq(accounts.personId, actorId));
  if (!account || !(await verifyPassword(input.currentPassword, account.passwordHash))) {
    throw new DomainError("forbidden", "incorrect_current_password");
  }
  const passwordHash = await hashPassword(input.newPassword);
  await inTransaction(ctx, async (tx) => {
    await tx.db.update(accounts).set({ passwordHash }).where(eq(accounts.personId, actorId));
    await revokeAllSessions(tx.db, actorId, currentSessionId);
  });
}

/**
 * Deactivates or reactivates an account (moderation). Deactivated people cannot sign in or act, and all their
 * sessions end; everything they contributed stays in the archive, attributed to them. The reason is published
 * in the moderation log (`GET /v1/activity?action=moderation.`).
 */
export async function setPersonActive(
  ctx: Ctx,
  handle: string,
  active: boolean,
  reason: string,
): Promise<PersonDto> {
  return inTransaction(ctx, async (tx) => {
    const target = await findPersonByHandle(tx.db, handle);
    authorize(ctx.actor, "person.moderate", { targetRole: target.role });
    if (target.id === ctx.actor.id) throw new DomainError("invariant_violated", "self_account_moderation");
    if (!target.deactivatedAt === active) {
      throw new DomainError("conflict", active ? "account_already_active" : "account_already_deactivated");
    }
    const [updated] = await tx.db
      .update(people)
      .set({ deactivatedAt: active ? null : sql`now()` })
      .where(eq(people.id, target.id))
      .returning();
    if (!active) await revokeAllSessions(tx.db, target.id);
    await recordActivity(tx, {
      action: active ? "moderation.person_reactivated" : "moderation.person_deactivated",
      subject: { kind: "person", id: target.id },
      payload: { reason },
    });
    return personDto(updated!);
  });
}

/**
 * Changes a person's platform role (admins only). Public in the ledger: who holds moderation power is part of
 * the platform's transparency.
 */
export async function assignRole(ctx: Ctx, handle: string, role: PersonRole): Promise<PersonDto> {
  authorize(ctx.actor, "role.assign");
  const actorId = ctx.actor.id;
  const target = await findPersonByHandle(ctx.db, handle);
  if (target.id === actorId) {
    throw new DomainError("invariant_violated", "self_role_change");
  }
  return applyRole(ctx, handle, role);
}

/**
 * Operator-only role change with no acting person — for appointing the first admin of a fresh deployment via
 * `scripts/set-role.ts`. NEVER expose this over HTTP.
 */
export async function assignRoleAsOperator(
  db: Database,
  handle: string,
  role: PersonRole,
): Promise<PersonDto> {
  return applyRole({ db, actor: null, weights: () => 1 }, handle, role);
}

async function applyRole(ctx: Ctx, handle: string, role: PersonRole): Promise<PersonDto> {
  return inTransaction(ctx, async (tx) => {
    const target = await findPersonByHandle(tx.db, handle);
    if (target.role === role) return personDto(target);
    const [updated] = await tx.db.update(people).set({ role }).where(eq(people.id, target.id)).returning();
    await recordActivity(tx, {
      action: "person.role_changed",
      subject: { kind: "person", id: target.id },
      payload: { from: target.role, to: role },
    });
    return personDto(updated!);
  });
}

export async function revokeSession(db: Database, sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(eq(sessions.id, sessionId));
}

const savedLocale = (tag: string | null): Locale | null => (tag && isLocale(tag) ? tag : null);

// ---------------------------------------------------------------- registration & login

export async function register(ctx: Ctx, input: RegisterRequest, ttlDays: number): Promise<AuthResponse> {
  if (!isValidHandle(input.handle)) throw new DomainError("validation_failed", "invalid_handle");
  const locale = input.locale === undefined ? null : requireLocale(input.locale);
  const passwordHash = await hashPassword(input.password);
  return inTransaction(ctx, async (tx) => {
    const [emailTaken] = await tx.db
      .select({ id: accounts.personId })
      .from(accounts)
      .where(eq(accounts.email, input.email));
    if (emailTaken) throw new DomainError("conflict", "email_taken");
    const [handleTaken] = await tx.db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.handle, input.handle));
    if (handleTaken) throw new DomainError("conflict", "handle_taken");

    const [person] = await tx.db
      .insert(people)
      .values({ handle: input.handle, displayName: input.displayName })
      .returning();
    await tx.db.insert(accounts).values({ personId: person!.id, email: input.email, passwordHash, locale });
    const actorCtx: Ctx = {
      ...tx,
      actor: { id: person!.id, role: person!.role, active: true, trust: "new" },
    };
    await recordActivity(actorCtx, {
      action: "person.registered",
      subject: { kind: "person", id: person!.id },
    });
    const session = await createSession(tx.db, person!.id, ttlDays);
    return {
      person: personDto(person!),
      token: session.token,
      expiresAt: iso(session.expiresAt),
      preferences: { locale },
    };
  });
}

export async function login(ctx: Ctx, input: LoginRequest, ttlDays: number): Promise<AuthResponse> {
  const [row] = await ctx.db
    .select({ person: people, passwordHash: accounts.passwordHash, locale: accounts.locale })
    .from(accounts)
    .innerJoin(people, eq(people.id, accounts.personId))
    .where(eq(accounts.email, input.email))
    .limit(1);
  const active = row && !row.person.deactivatedAt;
  const matches = await verifyPassword(input.password, active ? row.passwordHash : undefined);
  if (!active || !matches) {
    throw new DomainError("unauthenticated", "wrong_credentials");
  }
  const session = await createSession(ctx.db, row.person.id, ttlDays);
  return {
    person: personDto(row.person),
    token: session.token,
    expiresAt: iso(session.expiresAt),
    preferences: { locale: savedLocale(row.locale) },
  };
}

// ---------------------------------------------------------------- me & profiles

export async function getMe(ctx: Ctx): Promise<MeResponse> {
  if (!ctx.actor) throw new DomainError("unauthenticated", "sign_in_required");
  const [row] = await ctx.db
    .select({ person: people, email: accounts.email, locale: accounts.locale })
    .from(people)
    .innerJoin(accounts, eq(accounts.personId, people.id))
    .where(eq(people.id, ctx.actor.id));
  if (!row) throw notFound("person_not_found");
  return {
    person: personDto(row.person),
    email: row.email,
    preferences: { locale: savedLocale(row.locale) },
  };
}

export async function updateProfile(ctx: Ctx, input: UpdateProfileRequest): Promise<PersonDto> {
  if (!ctx.actor) throw new DomainError("unauthenticated", "sign_in_required");
  const actorId = ctx.actor.id;
  const locale = typeof input.locale === "string" ? requireLocale(input.locale) : input.locale;
  return inTransaction(ctx, async (tx) => {
    const changes: Partial<typeof people.$inferInsert> = {};
    if (input.displayName !== undefined) changes.displayName = input.displayName;
    if (input.bio !== undefined) changes.bio = input.bio;
    if (input.affiliation !== undefined) changes.affiliation = input.affiliation;
    if (input.capacities !== undefined) changes.capacities = [...new Set(input.capacities)];
    const [person] = Object.keys(changes).length
      ? await tx.db.update(people).set(changes).where(eq(people.id, actorId)).returning()
      : await tx.db.select().from(people).where(eq(people.id, actorId));
    if (Object.keys(changes).length) {
      await recordActivity(tx, {
        action: "person.profile_updated",
        subject: { kind: "person", id: actorId },
        payload: { fields: Object.keys(changes) },
      });
    }
    if (locale !== undefined) {
      await tx.db.update(accounts).set({ locale }).where(eq(accounts.personId, actorId));
    }
    return personDto(person!);
  });
}

async function findPersonByHandle(db: Database, handle: string): Promise<PersonRow> {
  const [person] = await db.select().from(people).where(eq(people.handle, handle.toLowerCase()));
  if (!person) throw notFound("person_not_found");
  return person;
}

export async function getProfile(ctx: Ctx, handle: string): Promise<ProfileDto> {
  const person = await findPersonByHandle(ctx.db, handle);
  const [counts] = await queryRows<ProfileDto["contributions"]>(
    ctx.db,
    sql`select
      (select count(*) from ideas where proposed_by = ${person.id} and hidden_at is null)::int as "ideasProposed",
      (select count(*) from idea_revisions where author_id = ${person.id} and status = 'accepted' and number > 1)::int as "revisionsAccepted",
      (select count(*) from claims where created_by = ${person.id} and hidden_at is null)::int as "claims",
      (select count(*) from evidence where contributed_by = ${person.id} and withdrawn_at is null and hidden_at is null)::int as "evidence",
      (select count(*) from arguments where author_id = ${person.id} and withdrawn_at is null and hidden_at is null)::int as "arguments",
      (select count(distinct submission_id) from evaluations where evaluator_id = ${person.id})::int as "evaluations",
      (select count(*) from comments where author_id = ${person.id} and hidden_at is null)::int as "comments",
      (select count(*) from initiatives where created_by = ${person.id} and hidden_at is null)::int as "initiatives",
      (select count(*) from evaluations ev
         where ev.dimension = 'useful' and ev.superseded_at is null and ev.evaluator_id <> ${person.id}
           and (ev.comment_id in (select id from comments where author_id = ${person.id})
             or ev.argument_id in (select id from arguments where author_id = ${person.id})))::int as "usefulReceived"`,
  );

  const [expertise, ideaRows, involvementRows] = await Promise.all([
    listExpertise(ctx.db, person.id),
    ctx.db
      .select({ id: ideas.id })
      .from(ideas)
      .where(and(eq(ideas.proposedBy, person.id), isNull(ideas.hiddenAt)))
      .orderBy(desc(ideas.createdAt))
      .limit(50),
    ctx.db
      .select()
      .from(involvements)
      .where(and(eq(involvements.personId, person.id), isNull(involvements.supersededAt)))
      .orderBy(desc(involvements.createdAt)),
  ]);
  const refs = await ideaRefs(
    ctx.db,
    involvementRows.map((r) => r.ideaId),
  );
  return {
    person: personDto(person),
    expertise,
    contributions: counts!,
    ideas: await listIdeaItems(
      ctx,
      ideaRows.map((r) => r.id),
    ),
    involvements: involvementRows
      .filter((r) => refs.has(r.ideaId))
      .map((r) => ({
        idea: refs.get(r.ideaId)!,
        capacity: r.capacity,
        status: r.status,
        since: iso(r.createdAt),
      })),
  };
}

export async function personIdByHandle(db: Database, handle: string): Promise<string> {
  return (await findPersonByHandle(db, handle)).id;
}

// ---------------------------------------------------------------- expertise

async function listExpertise(db: Database, personId: string): Promise<ExpertiseDto[]> {
  const rows = await db
    .select({ e: personExpertise, topic: { id: topics.id, slug: topics.slug, name: topics.name } })
    .from(personExpertise)
    .innerJoin(topics, eq(topics.id, personExpertise.topicId))
    .where(and(eq(personExpertise.personId, personId), isNull(personExpertise.revokedAt)));
  return rows.map((r) => ({ topic: r.topic, basis: r.e.basis, note: r.e.note, since: iso(r.e.createdAt) }));
}

export async function declareExpertise(ctx: Ctx, input: DeclareExpertiseRequest): Promise<ExpertiseDto[]> {
  authorize(ctx.actor, "signal.express");
  const actorId = ctx.actor.id;
  return inTransaction(ctx, async (tx) => {
    const [topic] = await tx.db.select().from(topics).where(eq(topics.slug, input.topic));
    if (!topic) throw new DomainError("validation_failed", "unknown_expertise_topic", { topic: input.topic });
    const [existing] = await tx.db
      .select({ id: personExpertise.id })
      .from(personExpertise)
      .where(
        and(
          eq(personExpertise.personId, actorId),
          eq(personExpertise.topicId, topic.id),
          eq(personExpertise.basis, "self_declared"),
          isNull(personExpertise.revokedAt),
        ),
      );
    if (!existing) {
      const [row] = await tx.db
        .insert(personExpertise)
        .values({ personId: actorId, topicId: topic.id, basis: "self_declared", note: input.note ?? "" })
        .returning();
      await recordActivity(tx, {
        action: "expertise.declared",
        subject: { kind: "expertise", id: row!.id },
        payload: { topic: topic.slug, basis: "self_declared" },
      });
    }
    return listExpertise(tx.db, actorId);
  });
}

export async function revokeExpertise(ctx: Ctx, topicSlug: string): Promise<ExpertiseDto[]> {
  authorize(ctx.actor, "signal.express");
  const actorId = ctx.actor.id;
  return inTransaction(ctx, async (tx) => {
    const [topic] = await tx.db.select().from(topics).where(eq(topics.slug, topicSlug));
    if (!topic) throw notFound("topic_not_found");
    const revoked = await tx.db
      .update(personExpertise)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(personExpertise.personId, actorId),
          eq(personExpertise.topicId, topic.id),
          eq(personExpertise.basis, "self_declared"),
          isNull(personExpertise.revokedAt),
        ),
      )
      .returning({ id: personExpertise.id });
    for (const r of revoked) {
      await recordActivity(tx, {
        action: "expertise.revoked",
        subject: { kind: "expertise", id: r.id },
        payload: { topic: topicSlug },
      });
    }
    return listExpertise(tx.db, actorId);
  });
}

export async function searchPeople(db: Database, q: string, limit: number) {
  const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  return db
    .select({ id: people.id, handle: people.handle, displayName: people.displayName })
    .from(people)
    .where(
      and(
        isNull(people.deactivatedAt),
        sql`(${people.handle} ilike ${pattern} or ${people.displayName} ilike ${pattern})`,
      ),
    )
    .limit(limit);
}
