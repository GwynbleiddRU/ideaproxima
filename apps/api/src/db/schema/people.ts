import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  CAPACITIES,
  EXPERTISE_BASES,
  PERSON_ROLES,
  SECURITY_EVENT_KINDS,
  type SecurityEventKind,
  type Capacity,
  type ExpertiseBasis,
  type PersonRole,
} from "@ideaproxima/domain";
import { createdAt, inList, pk, tstz } from "./_columns";

/**
 * PEOPLE — the public identity of a contributor. Attribution everywhere points here.
 * Credentials live in `accounts` so that identity survives changes of login method (OAuth, ORCID) and so that
 * an account can be erased (GDPR) while the person row is anonymised and their contributions stay attributed
 * to "a former contributor" rather than disappearing from history.
 */
export const people = pgTable(
  "people",
  {
    id: pk(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    affiliation: text("affiliation").notNull().default(""),
    /** Ways this person can advance ideas — the matching surface for researchers, engineers, funders. */
    capacities: text("capacities")
      .array()
      .$type<Capacity[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    role: text("role").$type<PersonRole>().notNull().default("member"),
    createdAt: createdAt(),
    deactivatedAt: tstz("deactivated_at"),
  },
  (t) => [
    uniqueIndex("people_handle_key").on(t.handle),
    check("people_role_check", inList("role", PERSON_ROLES)),
    check(
      "people_capacities_check",
      sql.raw(`"capacities" <@ array[${CAPACITIES.map((c) => `'${c}'`).join(",")}]::text[]`),
    ),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    personId: uuid("person_id")
      .primaryKey()
      .references(() => people.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: tstz("email_verified_at"),
    establishedAt: tstz("established_at"),
    termsVersion: text("terms_version"),
    termsAcceptedAt: tstz("terms_accepted_at"),
    confirmedMinimumAge: integer("confirmed_minimum_age"),
    ageConfirmedAt: tstz("age_confirmed_at"),
    locale: text("locale"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("accounts_email_key").on(t.email)],
);

export const tokenPurposes = ["verify_email", "reset_password", "change_email"] as const;
export const securityEvents = pgTable(
  "security_events",
  {
    id: pk(),
    personId: uuid("person_id").references(() => people.id),
    kind: text("kind").$type<SecurityEventKind>().notNull(),
    networkKeyHash: text("network_key_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    check("security_events_kind_check", inList("kind", SECURITY_EVENT_KINDS)),
    index("security_events_person_page_idx").on(t.personId, t.id),
    index("security_events_retention_idx").on(t.createdAt),
  ],
);
export type TokenPurpose = (typeof tokenPurposes)[number];
export const accountTokens = pgTable(
  "account_tokens",
  {
    id: pk(),
    personId: uuid("person_id").references(() => people.id),
    purpose: text("purpose").$type<TokenPurpose>().notNull(),
    email: text("email").notNull(),
    previousEmail: text("previous_email"),
    pendingRegistration: jsonb("pending_registration").$type<{
      handle: string;
      displayName: string;
      passwordHash: string;
      acceptance?: { termsVersion: string | null; minimumAge: number; confirmedAt: string };
      locale: string | null;
    }>(),
    tokenHash: text("token_hash"),
    createdAt: createdAt(),
    expiresAt: tstz("expires_at").notNull(),
    usedAt: tstz("used_at"),
  },
  (t) => [
    uniqueIndex("account_tokens_hash_key").on(t.tokenHash),
    index("account_tokens_person_purpose").on(t.personId, t.purpose),
    index("account_tokens_email_purpose").on(t.email, t.purpose),
    index("account_tokens_expiry").on(t.expiresAt),
    check("account_tokens_purpose_check", inList("purpose", tokenPurposes)),
  ],
);

/** Server-side sessions: revocable (moderation, logout everywhere) unlike stateless JWTs. Only token hashes are stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: pk(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    tokenHash: text("token_hash").notNull(),
    createdAt: createdAt(),
    expiresAt: tstz("expires_at").notNull(),
    revokedAt: tstz("revoked_at"),
    lastUsedAt: tstz("last_used_at"),
    userAgent: text("user_agent"),
    mfaAt: tstz("mfa_at"),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_key").on(t.tokenHash),
    index("sessions_person_idx").on(t.personId),
    index("sessions_person_page_idx")
      .on(t.personId, t.id)
      .where(sql`revoked_at is null`),
  ],
);

/**
 * TOPICS — the taxonomy. A table (not a hard-coded list) because topics have pages, hierarchy, and because
 * reputation and expertise are domain-specific: "useful judgment in biology" ≠ "useful judgment in governance".
 */
export const topics = pgTable(
  "topics",
  {
    id: pk(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    parentId: uuid("parent_id").references((): AnyPgColumn => topics.id),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("topics_slug_key").on(t.slug), index("topics_parent_idx").on(t.parentId)],
);

export const topicTranslations = pgTable(
  "topic_translations",
  {
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.locale] })],
);

/**
 * EXPERTISE — a person's claimed or verified competence in a topic, valid over a time range.
 * Kept as dated facts (not a profile field) so a future scoring system can ask "was this evaluator a verified
 * expert in this topic *when* they evaluated?".
 */
export const personExpertise = pgTable(
  "person_expertise",
  {
    id: pk(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    basis: text("basis").$type<ExpertiseBasis>().notNull(),
    note: text("note").notNull().default(""),
    verifiedBy: uuid("verified_by").references(() => people.id),
    createdAt: createdAt(),
    revokedAt: tstz("revoked_at"),
  },
  (t) => [
    uniqueIndex("person_expertise_current_key")
      .on(t.personId, t.topicId, t.basis)
      .where(sql`revoked_at is null`),
    index("person_expertise_topic_idx").on(t.topicId),
    check("person_expertise_basis_check", inList("basis", EXPERTISE_BASES)),
  ],
);
