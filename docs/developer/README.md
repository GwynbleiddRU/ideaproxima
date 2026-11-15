# Documentation for developers

For people who change, test, deploy or integrate with Ideaproxima.

| Document                               | Contents                                                                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Developer guide](developer-guide.md)  | Setup, repository map, architecture in brief, API conventions, everyday commands, step-by-step recipes (new endpoint, schema change, vocabulary, metrics and lenses), testing on PGlite and PostgreSQL, code conventions, troubleshooting. |
| [Operations guide](operations.md)      | Configuration reference, Docker and bare-metal deployment, first admin, migrations, backups and restore, security checklist, monitoring, maintenance (including legally required erasure), scaling.                                        |
| [API reference](api-reference.md)      | Every endpoint, parameter, request and response field. **Generated** by `npm run docs:api`; never edit by hand.                                                                                                                            |
| [`api/openapi.json`](api/openapi.json) | The same as an OpenAPI 3.1 document (also served at `GET /v1/openapi.json`). **Generated.**                                                                                                                                                |

The _reasons_ behind the architecture (decision records, domain and data-model reasoning) are in
[`../agents/`](../agents/README.md). They are written for agents, and they are equally useful to human maintainers.
