# Running the production program in Codex

Open the repository root in Codex. Start one fresh chat per phase on the same checkout. Read the [sequence and status](README.md#sequence-and-status) before selecting a prompt. Numbered rows determine the order. The filenames group related phases that can be weeks apart.

## Start a session

For step 1, select **GPT-6.2 Astra at high reasoning effort** and paste the instruction below. After that,
use the instruction printed by the preceding agent.

> Read AGENTS.md and prompts/api/00-immediate-hardening-prompt.md. Execute step 1 only. Confirm its prerequisites against the sequence and the current checkout. Implement the step using the repository's code quality rules. Run its checks, record the evidence and next eligible step, and commit your changes locally on main. Report the commit and finish with the model, reasoning effort and copy-ready instruction for the next chat. Stop at the handoff.

The prompts live on the owner’s machine. In a clean checkout, use the tracked numbered plan linked below in the same instruction, together with the [session protocol](README.md#how-a-session-works). A plan contains the phase scope, verification and owner decisions. Resume an interrupted row from its implementation notes and working diff. Publication of a release, changes to live systems, and acceptance of launch risk require the named owner decision.

## Choose the prompt and model

Each plan link below names its prompt. Under `prompts/api/`, use the plan's filename with `-prompt.md` in
place of `.md`. For example, step 6 uses `05-localization-prompt.md` and step 10 returns to
`03-rate-limiting-prompt.md`.

Use **GPT-6.2 Sol at medium effort** for bounded work and **GPT-6.2 Astra at high effort** for security, concurrency, cross-system consistency or evaluation. These are suggested starting settings for the coding agent. If a named model is absent from your picker, choose the available general coding model for Sol rows and the strongest available reasoning model for Astra rows. The product runs moderation locally as specified in plan 08. [OpenAI model selection](https://developers.openai.com/api/docs/guides/model-selection)

| Plan                                        | Step and phase                     | Suggested model           | Where to start and what to prove                                                                                        |
| ------------------------------------------- | ---------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [00](00-immediate-hardening.md)             | 1                                  | Astra                     | Prove the nine hardening findings through the HTTP and database entry points.                                           |
| [01](01-operational-foundations.md)         | 2 A, 3 B                           | Sol                       | Start with the request lifecycle. Capture a redacted request log in A and a draining instance in B.                     |
| [02](02-background-jobs.md)                 | 4 A, 5 B                           | Astra                     | Run queue ownership and crash recovery on real PostgreSQL before moving metric refresh to a worker.                     |
| [03](03-rate-limiting.md)                   | 10 A, 11 B, 12 C, T1 D             | Astra                     | Use one conformance suite across stores. Check the web response to a real 429 before adding proof of work.              |
| [04](04-accounts-and-trust.md)              | 13 A, 14 B, 26 C, 27 D             | Astra                     | Trace one credential from issuance to consumption, revocation or expiry. Exercise each flow as its intended actor.      |
| [05](05-localization.md)                    | 6 A, 7 B, 8 C1, 9 C2, 38 D         | Sol                       | Follow one message from API to browser, then expand by screen. Use a native review to promote a translation.            |
| [06](06-multilingual-content-and-search.md) | 15 A, 17 B, 18 C                   | Astra                     | Start with legacy revisions and mixed-script fixtures. Verify search after a visibility change and a rebuild.           |
| [07](07-moderation-core.md)                 | 16 A, 19 B, 20 C, 21 D             | Astra                     | Inventory text surfaces and actors. Follow a report through review, notice, independent appeal and restoration.         |
| [08](08-ai-moderation.md)                   | 22 A, 23 B, 24 C, 25 D, 47 E       | Astra                     | Pin local model and template hashes. Test policy with fakes, then measure the real classifier separately per language.  |
| [09](09-read-scalability.md)                | 28 A, 29 B, 30 C, T2 D             | Astra                     | Measure the reference dataset first. Exercise pagination under ranking changes and the cache through a shared proxy.    |
| [10](10-deployment-and-operations.md)       | 33 A, 34 B, 35 C, 36 D, 37 E, 39 F | Sol; Astra for A, C and F | Use isolated staging. Record the release digest, rollback result, measured recovery objectives and game-day failures.   |
| [11](11-semantic-search.md)                 | 45 A, 46 B                         | Astra                     | Establish the full-text baseline. Compare multilingual recall and latency, including an unavailable inference service.  |
| [12](12-public-api.md)                      | 40 A, 42 B, 43 C, 44 D             | Astra                     | Verify the actual contract delta. Exercise concurrent retries, key scopes and the public export with private fixtures.  |
| [13](13-public-web.md)                      | 31 A, 32 B                         | Sol; Astra for A          | Read each public page via plain HTTP and as a signed-in browser. Check visibility, cache headers and all three engines. |
| [14](14-launch-readiness.md)                | 41                                 | Astra                     | Start from the candidate revision and image digest. Trace each launch claim to evidence and issue the verdict.          |

## Hand off to the next chat

End the final reply with the recommended full model name and reasoning effort on one line, then one fenced
`text` block the owner can paste verbatim. Select the next row from the updated
[sequence](README.md#sequence-and-status). Resolve its **plan and phase** in the model table above and
check the exact prompt filename on disk. A new chat may return to the same file for another phase, or jump
to a different plan number. Where only tracked plans are available, give the actual tracked plan path.

Use the kickoff wording below with the real filename, step and phase filled in. This is the expected handoff
after a successful step 1. Include the verified commit hash and check results in the report above the block.

**GPT-6.2 Sol at medium reasoning effort**

```text
Read AGENTS.md and prompts/api/01-operational-foundations-prompt.md. Execute step 2 only (plan 01, phase A). Confirm its prerequisites against the sequence and the current checkout. Implement the step using the repository's code quality rules. Run its checks, record the evidence and next eligible step, and commit your changes locally on main. Report the commit and finish with the model, reasoning effort and copy-ready instruction for the next chat. Stop at the handoff.
```

- **Interrupted step.** Generate a resume instruction for the same step, phase, model and file. Name the
  checkpoint and unresolved condition. Tell the next agent to read the notes and finish the missing checks.
- **Gated successor.** If the current step is complete and the next row awaits an owner action or date,
  label the instruction “Use after …” and include that prerequisite inside the block. For example, step 42
  requires a recorded launch and step 47 requires the specified real-traffic interval.
- **Conditional or final step.** Offer T1 or T2 only when its trigger is documented after launch. When all
  numbered work is complete and no conditional row is eligible, end with “No next eligible step” and name
  any outstanding trigger. The owner can then tell whether another chat is needed.

## Which documents govern a decision

- Use the [concept](../../../concept.txt), [domain model](../domain-model.md) and [architecture decisions](../architecture.md) for facts, permissions, visibility, and the distinction between attention and quality. The [data model](../data-model.md) identifies guards, projections and rebuildable data.
- Check a proposed route against the [API architecture](../api-architecture.md), [generated API reference](../../developer/api-reference.md), [OpenAPI](../../developer/api/openapi.json) and its entry in the live contract catalogue. The [developer guide](../../developer/developer-guide.md) supplies the migration and test recipes.
- Read the affected journey in the [user guide](../../user/user-guide.md). Use the [operations guide](../../developer/operations.md) for the deployed configuration and operator procedures. Evidence for a new capability belongs in the numbered plan and the affected guide.
- Trace the [audit finding](api-audit.md) to the selected phase. Use the [roadmap](../roadmap.md) and [open questions](../open-questions.md) to distinguish approved defaults, owner decisions and later research. The [source review](../source-review.md) describes the historical prototype.

The two root sketches have separate purposes. Use `prompts/front-rebuild-prompt-sketch.md` as design history when changing an existing screen. Use `prompts/scoring-system-prompt-sketch.md` only for a separately commissioned research session (Astra recommended). Neither is a production step.
