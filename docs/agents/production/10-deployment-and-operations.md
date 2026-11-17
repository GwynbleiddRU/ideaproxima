# 10 — Production deployment and operations

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/10-deployment-and-operations-prompt-sketch.md`.

| Status     | Not started                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Depends on | [01](01-operational-foundations.md), [02](02-background-jobs.md); it deploys what plans 03–09 build |
| Unblocks   | The launch                                                                                          |
| Size       | 4 sessions · 13–19 engineer-days                                                                    |

## Outcome

A release is one reviewed, repeatable procedure; the data can be restored and that has been proven; the people
on call learn about a problem from an alert, not from a user; and the legal minimum for operating a public
service worldwide is in place ([audit](api-audit.md): OPS-6, OPS-7, OPS-8, PRIV-3; roadmap P0-3).

## Target topology

```text
 readers ─▶ CDN / WAF ─ TLS, HTTP/3, cache for /assets and public GETs, flood and bot rules
               │
               ▼
        load balancer ──▶ api × N       stateless: web app + /v1          ┐ one image,
                          worker × M    jobs: mail, metrics, moderation   ┘ two commands
                          inference × K llama-server, private network only  (plan 08)
                               │
          PostgreSQL primary ── point-in-time recovery, automated backups ──▶ replica (when triggered)
          object storage      backups, exports, model files
          mail provider       SMTP or API
          (Valkey/Redis)      only when the rate-limit store needs it (plan 03, phase D)
```

One region to begin with. "Worldwide" is delivered by the CDN for reads; writes travel to the origin. A second
region is a later decision with its own costs (replication, data residency) and is not part of this plan.

### Stages

| Stage                     | Compute                                                                     | Database                                             | Notes                                                         |
| ------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| Launch (≤ 10,000 monthly) | One 4 vCPU, 8 GB machine: API, worker and both moderation models in compose | Managed, 2 vCPU, 4 GB, 50 GB, point-in-time recovery | A second small machine if availability matters more than cost |
| Growth (~100,000)         | API × 2–3 (2 vCPU, 2 GB), worker × 1–2, one 8-core, 16 GB inference machine | 4–8 vCPU, 16–32 GB, one replica, a pooler            | Rate-limit store on PostgreSQL                                |
| Large (~1,000,000)        | API × 4–6 autoscaled, workers × 3–4, one GPU inference node                 | 16+ vCPU, 64 GB, two replicas, partitioned ledger    | Valkey for limits; consider a second region for reads         |

Order of magnitude for running costs, which vary three- to five-fold between budget and hyperscale providers:
tens of dollars a month at launch, a few hundred at growth, low thousands at large. Sizes come from the
capacity model in [09](09-read-scalability.md) and the inference sizing in [08](08-ai-moderation.md); replace
them with measured values.

### Platform

The application is twelve-factor already (configuration from the environment, stateless processes, one image),
so the platform is a choice, not a constraint:

- **Launch default: one virtual machine with Docker Compose and Caddy** for TLS, plus a managed PostgreSQL.
  It is the layout CI already exercises, it has the fewest moving parts, and it costs the least.
- **Growth:** a managed container platform (any of the mainstream ones) running the same image with separate
  `api` and `worker` services. Moving there is configuration.
- **Kubernetes:** only with a team to operate it.

Deliverable: `deploy/` with `compose.production.yml` (api, worker, inference, Caddy; the database is
external), a `Caddyfile`, an example environment file listing every secret, and `deploy/README.md`.

## Work

### A. Release pipeline

- CI builds the image once per commit on `main`, tags it with the commit SHA (and the version on a tag), and
  pushes it to a registry (GitHub Container Registry). The commit is baked in (`APP_COMMIT`, plan 01).
- A release workflow, triggered manually with an image tag: back up → run `migrate.js` and `seed.js` (the
  existing release step) → roll `worker` → roll `api` one instance at a time, waiting for `/readyz` → smoke
  test (the checks CI's stack job already has, against production) → on failure, roll back to the previous
  tag.
- **Migrations must be compatible with the previous release** (expand, migrate, contract): add columns and
  tables first, switch code, remove old structures in a later release. A rollback then never needs a down
  migration. Add this rule to the developer guide and to the migration recipe.
- The CI stack job runs the production compose file with separate `worker` and inference stand-ins, so
  multi-process behaviour is tested on every change (OPS-8).

### B. Observability stack

- Metrics: Prometheus-compatible scraping of `api`, `worker`, `llama-server` and PostgreSQL (through a standard
  exporter), into a hosted or self-hosted backend. Dashboards kept as code in `deploy/dashboards/`: traffic and
  latency by route, errors, database, jobs, rate limits, moderation.
- Logs: stdout JSON to the platform's collector; 30 days retention.
- Alerts, kept as code in `deploy/alerts/`:

  | Alert                   | Condition                                                                                                          |
  | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | Availability            | Error budget burn for a 99.9 % monthly target on `/v1` reads                                                       |
  | Latency                 | p95 above budget for 10 minutes                                                                                    |
  | Errors                  | 5xx above 1 % for 5 minutes                                                                                        |
  | Readiness               | Any instance not ready for 2 minutes                                                                               |
  | Jobs                    | Oldest pending job above 5 minutes; any failed job                                                                 |
  | Moderation              | A critical case older than 4 hours; assessment queue above 60 s; circuit breaker tripped; overturn rate above 10 % |
  | Abuse                   | `net.requests` rejections or registrations above 5× the weekly norm                                                |
  | Database                | Connections above 80 %; replication lag above 30 s; disk above 75 %                                                |
  | Backups                 | Newest verified backup older than 26 hours                                                                         |
  | Certificates and domain | Expiry within 14 days                                                                                              |

- An uptime probe from outside the hosting provider, hitting the home page and `/v1/health`.

### C. Backups that are known to work

- Managed point-in-time recovery, 14 days or more.
- A nightly logical dump (`pg_dump --format=custom`) encrypted and copied to object storage at a **different
  provider or region**, kept 30 daily, 12 monthly.
- **A weekly automated restore drill**: restore the newest dump into a scratch database, run
  `rebuild-metrics` and `rebuild-search`, then verify: migration state, row counts within tolerance of
  production, the history-guard triggers exist, a sample of ideas renders through the API. The drill's success
  is the "backups" metric the alert watches. An unrehearsed backup is not a backup.
- Recovery objectives to confirm with the owner: lose at most 5 minutes of data, be back within 4 hours.
- The archive is meant to outlive the platform (roadmap P3-18): once a year, publish a snapshot of the public
  facts to a long-term archive. Planned with the open-data work in [12](12-public-api.md).

### D. Security of the supply chain and the runtime

- Dependency updates by a bot, weekly, grouped, respecting the documented pins; `npm audit` fails CI on high
  severity; a scheduled image scan; a software bill of materials attached to each image; secret scanning;
  GitHub Actions pinned by commit.
- Runtime: the container already runs as an unprivileged user; add a read-only root filesystem, dropped
  capabilities, memory and CPU limits, and network rules so that only `api` is reachable from the load
  balancer and the inference and internal ports are reachable from nowhere else.
- Edge: HSTS (preload once stable), TLS 1.2 or newer, the WAF rules that implement layer L0 of
  [03](03-rate-limiting.md), `TRUST_PROXY_HOPS` or `CLIENT_IP_HEADER` set to match the edge exactly.
- Secrets live in the platform's secret store; a rotation runbook covers the database password,
  `SECRETS_KEY`, `RATE_LIMIT_KEY_SECRET`, `CHALLENGE_SECRET` and mail credentials.
- A `security.txt` and a short vulnerability-disclosure policy.

### E. Runbooks and compliance

Runbooks in `docs/developer/runbooks/`, each one page, each rehearsed once: deploy and roll back; database
failover and restore; a spam or abuse wave; the moderation model down or misbehaving; a legal removal or
erasure request; a suspected account or key compromise; secret rotation.

Compliance, as far as engineering can take it (the texts and the legal judgement are the owner's):

| Topic                                    | In place after this program                                                                                                                                                                                    | Owner decides                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Privacy (GDPR and similar laws)          | Self-service export and deletion (plan 04); a retention schedule enforced by jobs: sessions 30 days after expiry, security events 90 days, job records 7–30 days, rate-limit keys minutes; hashed network keys | Privacy notice; processors and their agreements                                       |
| Cookies                                  | Only the strictly necessary session cookie; no analytics, no third-party scripts                                                                                                                               | Whether to add privacy-respecting analytics                                           |
| Platform regulation (EU DSA and similar) | Reporting, statements of reasons, appeals, public statistics (plan 07); disclosure of automated moderation (plan 08)                                                                                           | Legal representative and contact points; terms                                        |
| Child-safety material                    | Zero-tolerance reason code, immediate hide, evidence preservation runbook                                                                                                                                      | The reporting duty in the operating jurisdiction                                      |
| Licences                                 | The mechanism to record acceptance (plan 04)                                                                                                                                                                   | Code licence; contribution licence (questions 12, 25)                                 |
| Reachability                             | No third-party fonts, scripts or CAPTCHAs; self-hosted everything on the request path                                                                                                                          | Hosting and mail providers that reach each target country; data-residency obligations |

### F. A game day before launch

Run the load test of plan 09 against the production layout, then rehearse failures while it runs: kill an API
instance, kill the worker, stop the inference service, fail the database over, restore from backup into a
fresh environment. Each must end with the documented alert firing and the runbook working. Record the results.

## Phases

| Phase | Scope                                                           | Days |
| ----- | --------------------------------------------------------------- | ---- |
| A     | `deploy/`, image publishing, release workflow, multi-process CI | 3–4  |
| B     | Dashboards, alerts, uptime probe                                | 3–4  |
| C     | Backup jobs and the automated restore drill                     | 2–3  |
| D     | Supply-chain and runtime hardening, edge configuration          | 2–3  |
| E     | Runbooks, retention jobs, compliance documents (skeletons)      | 2–3  |
| F     | Game day and its report                                         | 1–2  |

## Verification

- A release and a rollback performed end to end on a staging environment from the workflow alone.
- The restore drill has passed three consecutive weekly runs.
- Every alert has been made to fire once, deliberately, and reached a person.
- The game-day report exists and every failed expectation has an issue.

## Documentation to update

`docs/developer/operations.md` (it becomes the entry point to `deploy/` and the runbooks),
`docs/agents/architecture.md` (ADR-19 extended: production layout and the compatibility rule for migrations),
`docs/agents/roadmap.md` (P0-3), `README.md`.

## Decisions for the owner

1. Hosting, CDN and mail providers (each must reach the target countries).
2. Recovery objectives and the availability target.
3. Who is on call, and through which channel alerts arrive.
4. The legal texts and the licences.
