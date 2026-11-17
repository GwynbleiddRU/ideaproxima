# 04 — Accounts, e-mail and trust

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/04-accounts-and-trust-prompt-sketch.md`.

| Status     | Not started                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Depends on | [02](02-background-jobs.md) (e-mail is sent by jobs), [03](03-rate-limiting.md) (`auth.recovery`, trust tiers) |
| Unblocks   | `TRUST_REQUIRE_VERIFIED_EMAIL`; notices in [07](07-moderation-core.md); the launch                             |
| Size       | 4 sessions · 12–16 engineer-days                                                                               |

## Outcome

An account is tied to a mailbox its owner controls; a lost password is recoverable; a person can see and end
their sessions; scientists can sign in with ORCID; moderators cannot act without a second factor; and anyone
can export or delete their account without an operator ([audit](api-audit.md): SEC-2, SEC-8, SEC-12, PRIV-1,
PRIV-2; roadmap P0-1).

## Principles

1. **Do not reveal whether an address has an account.** Verification and recovery answer the same way for known
   and unknown addresses; the truth travels by e-mail. Registration is the one documented trade-off (below).
2. **Tokens are secrets with a short life.** Stored hashed (SHA-256, like session tokens), single use, expiring.
3. **Security events stay out of the public ledger** (as password changes already do). They go to a private,
   short-lived security log.
4. **Identity survives its credentials.** `people` remains the public identity; credentials and identities
   hang off `accounts` and can change or be erased.

## Design

### E-mail delivery

- `MailSender` interface with adapters `log` (default in development and tests: prints the message and its
  links), `smtp` (`nodemailer`; works with any provider) and room for provider HTTP APIs later.
  `MAIL_TRANSPORT`, `MAIL_FROM`, `SMTP_URL`, `PUBLIC_BASE_URL` (used to build links; required in production).
- Sending is a job (`mail.send`, queue `mail`) enqueued in the transaction that created the token. Payload:
  template name, recipient account id, parameters; never the rendered body. The job id is the idempotency key.
- Templates are functions in `modules/mail/templates/` returning subject, text and minimal HTML. They take
  their strings from the translator introduced by [05](05-localization.md); until that lands they use a
  one-locale stub with the same interface, so no template is rewritten later.
- Deliverability is an operations concern (SPF, DKIM, DMARC, a provider that reaches every region): see
  [10](10-deployment-and-operations.md).

### Tokens

```sql
create table account_tokens (
  id          uuid primary key,
  person_id   uuid not null references people(id),
  purpose     text not null,          -- verify_email | reset_password | change_email
  token_hash  text not null unique,
  email       text not null,          -- the address the token was sent to
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
```

Operational state (no history guard). Lifetimes: verification 48 h, reset 1 h, e-mail change 24 h. Issuing a
new token of a purpose invalidates the previous unused one. A purge schedule deletes rows 30 days after expiry.

### Flows and endpoints

| Endpoint                               | Behaviour                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `POST /v1/auth/register`               | Creates the account unverified, signs in, sends the verification message (see "Registration" below)   |
| `POST /v1/auth/verify-email`           | `{ token }` → sets `accounts.email_verified_at`                                                       |
| `POST /v1/auth/verify-email/resend`    | Signed-in; governed by `auth.recovery`                                                                |
| `POST /v1/auth/password-reset/request` | `{ email }` → always 202; sends a reset link if the account exists                                    |
| `POST /v1/auth/password-reset/confirm` | `{ token, newPassword }` → sets the password, revokes every session, sends a notice                   |
| `POST /v1/me/email`                    | `{ newEmail, currentPassword }` → sends a confirmation to the new address and a notice to the old one |
| `GET /v1/me/sessions`                  | The caller's active sessions: created, last used, user-agent family, current flag                     |
| `DELETE /v1/me/sessions/:session`      | Ends one session                                                                                      |
| `POST /v1/me/sessions/revoke-others`   | Ends all but the current one                                                                          |

**Registration.** Verification, reset and e-mail change are non-enumerating by construction. Registration is
the exception, and it is a real trade-off for the owner:

- **Default: sign in immediately, verify afterwards.** No friction: the account works at once, in the `new`
  tier with tight limits until the address is verified. A duplicate e-mail must then answer differently from a
  success (409, reason `email_taken`), so registration can still be used to test whether an address has an
  account. The probing rate is bounded by `auth.register` (3 per hour per network) and by the proof of work
  from plan 03.
- **Strict alternative: no session until verified.** Registration always answers 202 "check your e-mail"; the
  account is created when the link is opened; an address that already has an account receives "someone tried
  to register with your address" instead. No enumeration at all, at the cost of sign-up friction.
  `REGISTRATION_MODE=immediate|verified-first` selects the behaviour, so the decision can change later without
  a code change.

**Sessions.** Add `last_used_at`, `user_agent` (truncated to 200 characters) and `mfa_at` to `sessions`.
`last_used_at` is written at most once per 10 minutes per session, so a request does not become a write.

**Passwords.** Keep scrypt. Add an optional breached-password check at registration, reset and change:
`PASSWORD_BREACH_CHECK=hibp` queries the Have I Been Pwned range API with the first five hex characters of the
SHA-1 (k-anonymity: the password never leaves the server). Time out after 1.5 s and treat failure as "not
breached"; default `off` in development and tests.

**Terms and licence.** `LEGAL_TERMS_VERSION` (unset = not required). When set, `RegisterRequest` requires
`acceptTerms: true`, and the account stores `terms_version` and `terms_accepted_at`; a later version prompts
re-acceptance at next sign-in through `MeResponse.termsAcceptanceRequired`. The texts themselves, and the
licence for contributions (open question 12), are owner decisions; this plan only builds the mechanism.

### Trust tiers

The function specified in [03](03-rate-limiting.md) gets its real inputs here: `email_verified_at`, account
age, `restricted_until` (written by [07](07-moderation-core.md)) and `established_at`. A daily job
(`trust.recompute`) sets or clears `accounts.established_at` from the rule (30 days, 10 contributions, no
upheld decision in 90 days). `MeResponse` exposes the caller's tier and what would raise it ("Verify your
e-mail to lift the new-account limits"). After verification ships and existing accounts have been invited to
verify, set `TRUST_REQUIRE_VERIFIED_EMAIL=true`.

### Federated sign-in: ORCID, then others

```sql
create table account_identities (
  id          uuid primary key,
  person_id   uuid not null references people(id),
  provider    text not null,                 -- orcid | google | github
  subject     text not null,                 -- the provider's stable user id (the ORCID iD for orcid)
  email       text,
  linked_at   timestamptz not null default now(),
  unlinked_at timestamptz,
  unique (provider, subject)
);
```

- Authorization-code flow with PKCE, `state` and (for OpenID Connect providers) `nonce`, stored in a short-lived
  signed cookie. `GET /v1/auth/oauth/:provider/start` redirects; `GET /v1/auth/oauth/:provider/callback`
  completes and redirects into the web app. Library: `arctic` (small, no dependencies, covers Google and
  GitHub and has a generic client) or `openid-client` (certified OpenID Connect, covers ORCID and Google);
  the agent confirms ORCID support and picks one, not both.
- Linking rules: sign in if `(provider, subject)` is known. Otherwise, if the provider asserts a **verified**
  e-mail that matches an account, ask the person to sign in to that account once and link from
  `Account settings` (never link silently). Otherwise create a new account, e-mail already verified.
- **ORCID is first** because the primary audience is scientists. A linked ORCID iD is shown on the public
  profile (`PersonDto.orcid`) and recorded as evidence for verified expertise (roadmap P2-14). The ORCID iD is
  public by design; nothing else from the provider is stored.
- Accounts created by federation have no password; "set a password" uses the reset flow.

### Second factor for staff

- TOTP (RFC 6238, SHA-1, 6 digits, 30 s): `account_totp(person_id primary key, secret_encrypted, confirmed_at)`
  and ten single-use recovery codes stored hashed. Secrets are encrypted with AES-256-GCM under
  `SECRETS_KEY` (32 random bytes, base64). Implementation: `otplib`, or ~40 lines over `node:crypto`.
- Endpoints: `POST /v1/me/mfa/totp/setup`, `/confirm`, `DELETE /v1/me/mfa/totp` (needs a valid code), and
  `POST /v1/auth/mfa` to complete a sign-in.
- Enforcement: when `STAFF_MFA_REQUIRED=true` (the production default), `authorize()` callers for
  `content.moderate`, `person.moderate`, `role.assign`, `topic.manage` and the moderation actions of plan 07
  additionally require `session.mfa_at` within the last 12 hours; otherwise 403 with reason `mfa_required`.
  The check lives next to the policy so it is reviewable in one place. Members may enable TOTP voluntarily.

### Leaving: export and deletion

- `POST /v1/me/export` enqueues a job that assembles everything the account holds or authored (profile,
  account data, contributions with ids, sessions metadata) as JSON in a zip, stored for 7 days, and e-mails a
  one-time link (`GET /v1/me/exports/:id`). At most one export per 24 hours.
- `POST /v1/me/delete` `{ currentPassword }` starts a 14-day grace period (the account is deactivated and can
  be restored by signing in). Then a job performs the documented erasure: delete `accounts`, `sessions`,
  tokens, identities and TOTP rows; anonymise the `people` row (handle `former-<short id>`, display name
  "Former contributor", empty bio and affiliation). Contributions remain, attributed to the anonymised
  person, exactly as the operations guide already prescribes. The ledger records `person.deleted` without
  personal data.
- Court-ordered removal of specific content stays an operator procedure
  ([10](10-deployment-and-operations.md)).

### Security log

`security_events(id, person_id, kind, network_key_hash, user_agent, created_at)`: sign-ins, failures, password
and e-mail changes, MFA changes, session revocations, exports, deletions. Private (the account owner sees
their own in `Account settings`; staff need a reason), retained 90 days, purged by a schedule. It is not the
activity ledger and never contains public contributions.

## Phases

| Phase | Scope                                                                                                        | Days |
| ----- | ------------------------------------------------------------------------------------------------------------ | ---- |
| A     | Mail sender and job, tokens, verification, password reset, e-mail change, both registration modes, web pages | 4–5  |
| B     | Session list and revocation, security log, trust inputs and the daily job, terms mechanism                   | 2–3  |
| C     | ORCID sign-in and linking, then Google and GitHub; profile ORCID badge                                       | 3–4  |
| D     | TOTP and staff enforcement; export; deletion with grace period                                               | 3–4  |

New pages in phases A, C and D are previewed in `designs/` and approved before they are implemented.

## Verification

- Integration: each flow end to end with the `log` transport (the test reads the link from the captured
  message); expired, reused and wrong-purpose tokens; identical responses and comparable timing for known and
  unknown addresses; reset revokes all sessions; `auth.recovery` limits; staff action without MFA is 403.
- Federation: a fake provider (an in-process OAuth server in the test harness) for the full flow, including
  `state` mismatch and the "verified e-mail matches an existing account" branch.
- Deletion: after the job, no row in `accounts`, `sessions`, tokens or identities references the person; their
  ideas still resolve; the history guards were not disabled.
- Every new endpoint is in the catalogue with its limits; `npm run check`, `npm run test:pg`, `npm run test:e2e`.

## Documentation to update

`docs/agents/architecture.md` (extend ADR-12; new ADR for federation and MFA), `docs/agents/data-model.md`,
`docs/agents/open-questions.md` (close 21; update 19 with the self-service path),
`docs/developer/operations.md` (mail, secrets, the erasure section), `docs/user/user-guide.md` (accounts).

## Decisions for the owner

1. `REGISTRATION_MODE`: `immediate` (default) or `verified-first`.
2. The terms, the privacy notice and the contribution licence (and with it `LEGAL_TERMS_VERSION`).
3. Which providers beyond ORCID to enable at launch.
4. The mail provider (it must deliver to every target region).
