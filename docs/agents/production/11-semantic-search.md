# 11 — Semantic and cross-language search, duplicate detection

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/11-semantic-search-prompt.md`.

| Status     | Not started. After launch                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depends on | [06](06-multilingual-content-and-search.md) (the search module and languages), [02](02-background-jobs.md), [03](03-rate-limiting.md) (`mutates`, `read.search`), the inference service of [08](08-ai-moderation.md) |
| Unblocks   | Roadmap P1-9 (duplicates), P3-16 (semantic search); better spam detection                                                                                                                                            |
| Size       | 2 sessions (steps 45–46) · 5–8 engineer-days                                                                                                                                                                         |

## Outcome

A scientist searching in English finds the relevant idea written in Japanese; someone proposing an idea is
shown the ideas and claims that already say the same thing, so they extend or link instead of duplicating; and
near-identical spam posted from many accounts is visible as a cluster (open questions 3 and 23).

This is the feature that turns twelve language communities into one archive, which is why it is planned even
though it comes after launch.

## Design

### Embeddings as derived data

```sql
create extension if not exists vector;         -- pgvector

create table search_embeddings (               -- DERIVED; single writer: modules/search
  subject_kind text not null, subject_id uuid not null,
  model        text not null,                  -- e.g. 'multilingual-e5-small@Q8'
  content_hash text not null,
  embedding    vector(384) not null,
  embedded_at  timestamptz not null default now(),
  primary key (subject_kind, subject_id, model)
);
create index search_embeddings_hnsw on search_embeddings using hnsw (embedding vector_cosine_ops);
```

- Written by a job (`search.embed`) enqueued by the same call that maintains `search_documents`; skipped when
  the content hash is unchanged. Rebuildable with `npm run search:rebuild -- --embeddings`.
- Ideas are embedded as title + summary; claims as their statement. Long narrative sections are not embedded
  in the first version.
- pgvector is the first PostgreSQL extension this project requires. It is available on every mainstream
  managed service, and the pinned PGlite (0.3.16) bundles it (`@electric-sql/pglite/vector`), so tests keep
  running in process. The official `postgres:17-alpine` image used by the compose file and CI does not include
  it: both move to an image that does (for example `pgvector/pgvector:pg17`, pinned by digest).

### The embedding model

Requirements: multilingual across the twelve languages, small enough for the CPU inference machine, a
permissive licence, and served by the same `llama-server` (it has an embeddings endpoint).

| Candidate               | Size | Dimensions              | Licence     | Note                                           |
| ----------------------- | ---- | ----------------------- | ----------- | ---------------------------------------------- |
| `multilingual-e5-small` | 118M | 384                     | MIT         | Smallest and fastest; the default to beat      |
| `Qwen3-Embedding-0.6B`  | 0.6B | up to 1024, truncatable | Apache-2.0  | Stronger; same family as the moderation models |
| `EmbeddingGemma`        | 0.3B | up to 768, truncatable  | Gemma terms | Strong for its size; check the terms           |
| `bge-m3`                | 568M | 1024                    | MIT         | Long inputs; larger index                      |

Choose by measurement on a small cross-language retrieval fixture (a query in one language must retrieve its
translated counterpart among distractors, for all language pairs that matter), not by leaderboard. The table
column is sized for the chosen model; changing models is a rebuild, because the `model` label is part of the
key. Verify each candidate's current licence and availability before the decision.

Index size is not a concern at this scale: one million 384-dimension vectors are about 1.5 GB plus the index.

### Hybrid ranking

`GET /v1/search` and `GET /v1/ideas?q=` combine the full-text result list of plan 06 with the nearest
neighbours of the query's embedding using reciprocal rank fusion, which needs no score calibration between
the two. If the inference service is unavailable or slow (a 300 ms budget), the search silently returns the
full-text result. Semantic matches are marked in the response (`match: "text" | "meaning" | "both"`) so the
interface can say why a result in another language appeared.

### Suggestions, never facts

| Endpoint                                      | Use                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `POST /v1/ideas/similar` `{ title, summary }` | In the editor: "ideas like this already exist" before proposing                  |
| `POST /v1/claims/similar` `{ statement }`     | When adding a claim: link the existing claim instead of restating it             |
| `GET /v1/ideas/:idea/similar`                 | On an idea page: possibly related ideas, clearly labelled as machine suggestions |

A suggestion is never recorded as a relation, a claim link or an evaluation. Relations stay typed and
human-made (open question 1); linking an existing claim strengthens the shared-claim graph, which is the
point. Everything shown is labelled as a machine suggestion with the model's name, as the concept requires of
AI assistance. These endpoints are rate-limited under `read.search`; the two `POST`s declare
`mutates: false` ([03](03-rate-limiting.md#the-contract-declares-the-policy)), because they change nothing.

### A signal for moderation

The same vectors let the rules classifier of plan 08 detect near-duplicate texts across accounts (a cluster of
new accounts posting the same pitch in different words). It is a signal for a case, like any other.

## Phases

| Phase | Scope                                                                                                | Days |
| ----- | ---------------------------------------------------------------------------------------------------- | ---- |
| A     | pgvector, the table, the job, the model choice by fixture, rebuild, hybrid ranking                   | 3–5  |
| B     | Similar-idea and similar-claim endpoints, editor and claim-dialog integration, the moderation signal | 2–3  |

## Verification

- The cross-language fixture: recall at 5 of the translated counterpart at least 0.90 for each language paired
  with English and at least 0.80 for pairs without English (initial targets; below them, the owner decides).
- Search still answers, with text results only, when the inference service is stopped.
- Hidden and held subjects never appear in neighbours or suggestions for non-moderators.
- Rebuild equals incremental for the embeddings table (by content hash).
- `npm run check`, `npm run test:pg`.

## Decisions for the owner

1. Whether "similar ideas exist" is shown before proposing (default: yes, as a non-blocking suggestion).
