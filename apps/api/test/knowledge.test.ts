import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ArgumentDto,
  ClaimDetailDto,
  EvidenceDto,
  IdeaClaimDto,
  IdeaDetail,
  SourceDto,
  Page,
  ActivityDto,
} from "@ideaproxima/contracts";
import { createHarness, type Harness } from "./harness";

let h: Harness;
let alice: Awaited<ReturnType<Harness["user"]>>;
let bob: Awaited<ReturnType<Harness["user"]>>;
let carol: Awaited<ReturnType<Harness["user"]>>;

beforeAll(async () => {
  h = await createHarness();
  [alice, bob, carol] = [await h.user("alice"), await h.user("bob"), await h.user("carol")];
});
afterAll(() => h.close());

const addClaim = (token: string, ideaId: string, body: Record<string, unknown>) =>
  h.call<IdeaClaimDto>("POST", `/ideas/${ideaId}/claims`, { token, body });

describe("claims", () => {
  it("links a new claim with a role; the author's assessment is just an evaluation", async () => {
    const idea = await h.idea(alice.token);
    const res = await addClaim(alice.token, idea.id, {
      statement: "Engineered binding sites can selectively recognise a contaminant class.",
      role: "mechanism",
      assessment: { support: 4, plausibility: 4, confidence: "medium" },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      role: "mechanism",
      ideaCount: 1,
      derived: { status: "supported", support: { n: 1, mean: 4 } },
    });

    // Two more assessors disagree sharply → the status becomes derived "contested". Nobody typed that in.
    for (const [user, value] of [
      [bob, 1],
      [carol, 5],
    ] as const) {
      await h.call("POST", "/evaluations", {
        token: user.token,
        body: { target: { kind: "claim", id: res.body.id }, ratings: [{ dimension: "support", value }] },
      });
    }
    await h.call("POST", "/evaluations", {
      token: bob.token,
      body: { target: { kind: "claim", id: res.body.id }, ratings: [{ dimension: "support", value: 1 }] },
    });
    const claims = await h.call<IdeaClaimDto[]>("GET", `/ideas/${idea.id}/claims`);
    expect(claims.body[0]!.derived.status).toBe("contested");
  });

  it("shares one claim across ideas so evidence informs all of them", async () => {
    const a = await h.idea(alice.token, { title: "Nanoscale water purifiers" });
    const b = await h.idea(bob.token, { title: "Self-powered medical microbots" });
    const claim = await addClaim(alice.token, a.id, {
      statement: "Nanoscale devices can harvest energy from their medium.",
      role: "prerequisite",
    });
    const linked = await addClaim(bob.token, b.id, { claimId: claim.body.id, role: "prerequisite" });
    expect(linked.status).toBe(201);
    expect(linked.body.ideaCount).toBe(2);
    expect((await addClaim(bob.token, b.id, { claimId: claim.body.id, role: "prerequisite" })).status).toBe(
      409,
    );

    const ev = await h.call<EvidenceDto>("POST", `/claims/${claim.body.id}/evidence`, {
      token: carol.token,
      body: {
        source: {
          kind: "peer_reviewed_article",
          title: "Illustrative example — not a real publication",
          doi: "https://doi.org/10.5555/EXAMPLE.1",
        },
        stance: "supports",
        summary: "Demonstrates harvesting in a bench-top medium.",
        limitations: "Does not establish operation in open water.",
      },
    });
    expect(ev.status).toBe(201);
    expect(ev.body.source?.doi).toBe("10.5555/example.1");
    expect(ev.body.limitations).toMatch(/does not establish/i);

    for (const idea of [a, b]) {
      const detail = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
      expect(detail.body.signals.counts).toMatchObject({ claims: 1, evidence: 1, evidenceSupporting: 1 });
      const timeline = await h.call<Page<ActivityDto>>("GET", `/ideas/${idea.id}/timeline`);
      expect(timeline.body.items.map((x) => x.action)).toContain("evidence.attached");
    }

    const detail = await h.call<ClaimDetailDto>("GET", `/claims/${claim.body.id}`);
    expect(detail.body.ideas.map((i) => i.title).sort()).toEqual([
      "Nanoscale water purifiers",
      "Self-powered medical microbots",
    ]);
    expect(detail.body.evidence).toHaveLength(1);
  });

  it("deduplicates sources by DOI and refuses double attachment", async () => {
    const first = await h.call<SourceDto>("POST", "/sources", {
      token: bob.token,
      body: { kind: "dataset", title: "Illustrative dataset", doi: "10.5555/DUP" },
    });
    const again = await h.call<SourceDto>("POST", "/sources", {
      token: carol.token,
      body: { kind: "dataset", title: "Different title, same DOI", doi: "doi:10.5555/dup" },
    });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect(
      (
        await h.call("POST", "/sources", {
          token: bob.token,
          body: { kind: "dataset", title: "Bad DOI", doi: "nope" },
        })
      ).status,
    ).toBe(400);

    const idea = await h.idea(alice.token);
    const claim = await addClaim(alice.token, idea.id, {
      statement: "A claim that a dataset could support.",
      role: "premise",
    });
    const attach = () =>
      h.call("POST", `/claims/${claim.body.id}/evidence`, {
        token: bob.token,
        body: { sourceId: first.body.id, stance: "mixed", summary: "Partly consistent with the claim." },
      });
    expect((await attach()).status).toBe(201);
    expect((await attach()).status).toBe(409);
    expect(
      (
        await h.call("POST", `/claims/${claim.body.id}/evidence`, {
          token: bob.token,
          body: { stance: "supports", summary: "No basis given at all." },
        })
      ).status,
    ).toBe(400);
  });

  it("withdraws evidence instead of deleting it, and only by its contributor", async () => {
    const idea = await h.idea(alice.token);
    const claim = await addClaim(alice.token, idea.id, {
      statement: "Another claim needing evidence.",
      role: "premise",
    });
    const ev = await h.call<EvidenceDto>("POST", `/claims/${claim.body.id}/evidence`, {
      token: bob.token,
      body: {
        source: { kind: "web_page", title: "Illustrative page", url: "https://example.org/x" },
        stance: "challenges",
        summary: "Counter-indication found.",
      },
    });
    expect(
      (
        await h.call("POST", `/evidence/${ev.body.id}/withdraw`, {
          token: carol.token,
          body: { reason: "Not mine" },
        })
      ).status,
    ).toBe(403);
    const withdrawn = await h.call<EvidenceDto>("POST", `/evidence/${ev.body.id}/withdraw`, {
      token: bob.token,
      body: { reason: "Misread the study" },
    });
    expect(withdrawn.body.withdrawnAt).toBeTruthy();
    const claimView = await h.call<ClaimDetailDto>("GET", `/claims/${claim.body.id}`);
    expect(claimView.body.evidence[0]!.withdrawnReason).toBe("Misread the study"); // still on record
    expect(claimView.body.evidenceCounts.challenges).toBe(0); // but no longer counted
  });

  it("redacts all four evidence text fields in the contributor's withdrawal response", async () => {
    const mod = await h.user("evidence-mod", "moderator");
    const idea = await h.idea(alice.token);
    const claim = await addClaim(alice.token, idea.id, {
      statement: "A claim with a dated source.",
      role: "premise",
    });
    const text = { summary: "Initial observation.", limitations: "Small sample.", locator: "Page 8" };
    const ev = await h.call<EvidenceDto>("POST", `/claims/${claim.body.id}/evidence`, {
      token: bob.token,
      body: {
        ...text,
        source: { kind: "web_page", title: "Example record", url: "https://example.org/record" },
        stance: "mixed",
      },
    });
    expect(ev.status).toBe(201);
    expect(
      (
        await h.call("POST", "/moderation", {
          token: mod.token,
          body: {
            target: { kind: "evidence", id: ev.body.id },
            action: "hide",
            reason: "Review pending",
          },
        })
      ).status,
    ).toBe(200);
    const withdrawnReason = "Source corrected.";
    const withdrawal = await h.call<EvidenceDto>("POST", `/evidence/${ev.body.id}/withdraw`, {
      token: bob.token,
      body: { reason: withdrawnReason },
    });
    expect(withdrawal.body).toMatchObject({
      hidden: true,
      summary: "",
      limitations: "",
      locator: "",
      withdrawnReason: "",
    });
    const review = await h.call<ClaimDetailDto>("GET", `/claims/${claim.body.id}`, { token: mod.token });
    expect(review.body.evidence[0]).toMatchObject({ ...text, withdrawnReason });
  });

  it("validates depth and unlinks (records removal) by curators only", async () => {
    const idea = await h.idea(alice.token);
    expect(
      (
        await addClaim(alice.token, idea.id, {
          statement: "A premise cannot have depth.",
          role: "premise",
          depth: 2,
        })
      ).status,
    ).toBe(400);
    const c = await addClaim(bob.token, idea.id, {
      statement: "Restored ecosystems would follow.",
      role: "consequence",
      depth: 4,
    });
    expect(c.body.depth).toBe(4);
    expect(
      (await h.call("POST", `/ideas/${idea.id}/claims/${c.body.linkId}/unlink`, { token: carol.token }))
        .status,
    ).toBe(403);
    expect(
      (await h.call("POST", `/ideas/${idea.id}/claims/${c.body.linkId}/unlink`, { token: alice.token }))
        .status,
    ).toBe(200);
    expect((await h.call<IdeaClaimDto[]>("GET", `/ideas/${idea.id}/claims`)).body).toHaveLength(0);
  });
});

describe("arguments", () => {
  it("supports counterarguments and rebuttal chains, and counts as independent review", async () => {
    const idea = await h.idea(alice.token);
    const counter = await h.call<ArgumentDto>("POST", "/arguments", {
      token: bob.token,
      body: {
        target: { kind: "idea", id: idea.id },
        stance: "opposes",
        title: "Simpler alternatives exist",
        body: "Membranes and activated carbon already solve most cases at known cost.",
      },
    });
    expect(counter.status).toBe(201);
    const rebuttal = await h.call<ArgumentDto>("POST", "/arguments", {
      token: alice.token,
      body: {
        target: { kind: "argument", id: counter.body.id },
        stance: "opposes",
        title: "Not for persistent pollutants",
        body: "PFAS removal at scale is exactly where membranes become prohibitively expensive.",
      },
    });
    expect(rebuttal.body.target).toEqual({ kind: "argument", id: counter.body.id });

    const view = await h.call<ArgumentDto & { replies: ArgumentDto[] }>(
      "GET",
      `/arguments/${counter.body.id}`,
    );
    expect(view.body.replyCount).toBe(1);
    expect(view.body.replies[0]!.id).toBe(rebuttal.body.id);

    const detail = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
    expect(detail.body.signals.counts.arguments).toBe(1);
    expect(detail.body.stageRequirements.find((r) => r.stage === "examined")?.met).toBe(true);

    // Strength is assessed by others — and you may not mark your own argument useful.
    await h.call("POST", "/evaluations", {
      token: carol.token,
      body: {
        target: { kind: "argument", id: counter.body.id },
        ratings: [
          { dimension: "strength", value: 4 },
          { dimension: "useful", value: 1 },
        ],
      },
    });
    const self = await h.call("POST", "/evaluations", {
      token: bob.token,
      body: {
        target: { kind: "argument", id: counter.body.id },
        ratings: [{ dimension: "useful", value: 1 }],
      },
    });
    expect(self.status).toBe(422);
    const listed = await h.call<ArgumentDto[]>("GET", `/ideas/${idea.id}/arguments`);
    expect(listed.body[0]!.derived).toMatchObject({ strength: { n: 1, mean: 4 }, usefulCount: 1 });
  });
});

describe("sources and withdrawals", () => {
  it("reports how often a source is cited, and withdraws arguments by their author only", async () => {
    const idea = await h.idea(alice.token);
    const source = await h.call<SourceDto>("POST", "/sources", {
      token: bob.token,
      body: {
        kind: "book",
        title: "Illustrative example (not a real publication): a monograph",
        url: "https://example.org/book",
      },
    });
    for (const statement of ["First claim citing the book.", "Second claim citing the book."]) {
      const claim = await addClaim(alice.token, idea.id, { statement, role: "premise" });
      await h.call("POST", `/claims/${claim.body.id}/evidence`, {
        token: bob.token,
        body: { sourceId: source.body.id, stance: "supports", summary: "The book discusses this directly." },
      });
    }
    expect((await h.call("GET", `/sources/${source.body.id}`)).body).toMatchObject({ citedBy: 2 });

    const arg = await h.call<ArgumentDto>("POST", "/arguments", {
      token: carol.token,
      body: {
        target: { kind: "idea", id: idea.id },
        stance: "qualifies",
        title: "Only at small scale",
        body: "This works only for contained deployments, not open waters.",
      },
    });
    expect((await h.call("POST", `/arguments/${arg.body.id}/withdraw`, { token: bob.token })).status).toBe(
      403,
    );
    const withdrawn = await h.call<ArgumentDto>("POST", `/arguments/${arg.body.id}/withdraw`, {
      token: carol.token,
    });
    expect(withdrawn.body.withdrawnAt).toBeTruthy();
    expect((await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`)).body.signals.counts.arguments).toBe(0);
  });
});
