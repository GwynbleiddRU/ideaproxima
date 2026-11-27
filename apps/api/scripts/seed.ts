/**
 * Seeds reference data (the topic taxonomy) and, with --demo, an illustrative dataset.
 *
 *   npm run db:seed            topics only (safe for any environment)
 *   npm run db:seed -- --demo  topics + demo people, ideas, claims, evidence, evaluations, relations, initiatives
 *
 * Demo content is created through the same domain services as the API, so every invariant is enforced and every
 * action lands in the activity ledger exactly as real usage would. All demo people are fictional ("demo-" handles),
 * and every demo source and outcome is explicitly labelled as illustrative — no real citations are invented.
 * Demo password for every account: "demo-password-123".
 */
import "../src/load-env";
import { eq } from "drizzle-orm";
import type { IdeaContentInput, IdeaDetail } from "@ideaproxima/contracts";
import { uniformWeights, type StanceKind } from "@ideaproxima/domain";
import { loadConfig } from "../src/config";
import { openDatabase, type Database } from "../src/db/client";
import { ensureBaseTopics } from "../src/db/reference-data";
import { people } from "../src/db/schema";
import * as graph from "../src/modules/graph/service";
import * as identity from "../src/modules/identity/service";
import { getIdeaDetail } from "../src/modules/ideas/queries";
import * as ideasService from "../src/modules/ideas/service";
import * as knowledge from "../src/modules/knowledge/service";
import * as practice from "../src/modules/practice/service";
import * as signals from "../src/modules/signals/service";
import * as discussion from "../src/modules/discussion/service";
import type { Ctx } from "../src/modules/shared/context";

const ILLUSTRATIVE = "Illustrative example (not a real publication)";

const PEOPLE = [
  {
    handle: "demo-mira",
    displayName: "Mira Okafor (demo)",
    bio: "Fictional environmental engineer working on water systems.",
    capacities: ["research", "engineering"],
  },
  {
    handle: "demo-teodor",
    displayName: "Teodor Lind (demo)",
    bio: "Fictional materials physicist. Writes careful critiques.",
    capacities: ["research"],
  },
  {
    handle: "demo-ana",
    displayName: "Ana Vehko (demo)",
    bio: "Fictional synthetic biologist; believes failed experiments are a public good.",
    capacities: ["research", "engineering"],
  },
  {
    handle: "demo-idris",
    displayName: "Idris Mensah (demo)",
    bio: "Fictional political theorist studying institutions that cross borders.",
    capacities: ["policy", "organizing"],
  },
  {
    handle: "demo-lucia",
    displayName: "Lúcia Ferraz (demo)",
    bio: "Fictional open-hardware organiser and small-grants funder.",
    capacities: ["funding", "organizing", "entrepreneurship"],
  },
  {
    handle: "demo-sun",
    displayName: "Sun Hae-jin (demo)",
    bio: "Fictional systems scientist.",
    capacities: ["research", "communication"],
  },
] as const;
type Handle = (typeof PEOPLE)[number]["handle"];

async function main() {
  const demo = process.argv.includes("--demo");
  const database = await openDatabase(loadConfig().db.url);
  await database.migrate();
  await ensureBaseTopics(database.db);
  console.info("Base topics ensured.");
  if (demo) await seedDemo(database.db);
  await database.close();
}

async function seedDemo(db: Database) {
  const [existing] = await db.select({ id: people.id }).from(people).where(eq(people.handle, "demo-mira"));
  if (existing) {
    console.info("Demo data already present — skipping.");
    return;
  }
  const base: Ctx = { db, actor: null, weights: uniformWeights };
  const as: Record<Handle, Ctx> = {} as Record<Handle, Ctx>;
  for (const p of PEOPLE) {
    const auth = await identity.register(
      base,
      {
        handle: p.handle,
        displayName: p.displayName,
        email: `${p.handle}@demo.ideaproxima.invalid`,
        password: "demo-password-123",
      },
      1,
      { minimumAge: 0, termsVersion: null },
    );
    as[p.handle] = { ...base, actor: { id: auth.person.id, role: "member", active: true, trust: "new" } };
    await identity.updateProfile(as[p.handle], { bio: p.bio, capacities: [...p.capacities] });
  }

  const propose = (who: Handle, content: IdeaContentInput) => ideasService.proposeIdea(as[who], content);
  const rate = (who: Handle, idea: IdeaDetail, ratings: Record<string, number>, rationale = "") =>
    signals.submitEvaluation(as[who], {
      target: { kind: "idea", id: idea.id },
      ratings: Object.entries(ratings).map(([dimension, value]) => ({ dimension, value })),
      rationale,
    });
  const stance = (who: Handle[], idea: IdeaDetail, kind: StanceKind) =>
    Promise.all(who.map((w) => signals.takeStance(as[w], idea.id, kind)));

  // ------------------------------------------------------------------ ideas
  const nanorobots = await propose("demo-mira", {
    title: "Water-cleaning nanorobots",
    summary:
      "Autonomous nanoscale machines capable of detecting and removing specific contaminants from water.",
    topics: ["environment", "technology"],
    tags: ["water", "nanotechnology", "pollution"],
    sections: {
      overview:
        "Swarms of machines far smaller than a cell could move through rivers, reservoirs and pipes, recognising individual contaminant molecules by shape and charge, binding them, and carrying them to collection points. Purification would become ambient and continuous instead of centralised.",
      motivation:
        "Many of the most harmful pollutants — persistent fluorinated compounds, heavy metals, pharmaceutical residues — are expensive to remove with centralised methods. A targeted, distributed approach could make purification as pervasive as the contamination itself.",
      mechanism:
        "Recognition surfaces with binding sites selective for one contaminant class; chemically or magnetically driven propulsion; bound contaminants concentrated at fixed capture stations; devices retrieved, recycled or designed to degrade into inert components.",
      uncertainties:
        "Whether autonomous behaviour is achievable without external guidance fields, and what free-roaming micro-agents would do to aquatic food webs, are both unknown.",
    },
  });
  const molecular = await propose("demo-teodor", {
    title: "Molecular manufacturing",
    summary:
      "General-purpose machines that build objects with atomic precision, making material scarcity a design choice rather than a limit.",
    topics: ["technology", "science"],
    tags: ["nanotechnology", "manufacturing"],
    sections: {
      overview:
        "Biology already assembles complex structures molecule by molecule. Molecular manufacturing proposes general-purpose machines that do the same for arbitrary materials.",
      challenges:
        "A long-running expert disagreement concerns whether positional chemistry can work reliably at useful rates.",
    },
  });
  const bacteria = await propose("demo-ana", {
    title: "Dioxin-accumulating bacteria",
    summary:
      "Engineered microbes that concentrate persistent organic pollutants so contaminated soil can be harvested clean.",
    topics: ["biology", "environment"],
    tags: ["bioremediation", "soil", "synthetic biology"],
    sections: {
      overview:
        "Rather than degrading dioxins (which risks toxic intermediates), engineered strains would sequester them intact inside harvestable biofilms that are then destroyed at high temperature.",
      prerequisites:
        "Reliable genetic containment (kill-switches), a regulatory path for contained field trials, and cheap biomass collection.",
    },
  });
  const assemblies = await propose("demo-idris", {
    title: "Lottery-selected citizens' assemblies for long-term decisions",
    summary:
      "Randomly selected, paid citizen panels deliberate on policies whose consequences outlive electoral cycles.",
    topics: ["governance", "society"],
    tags: ["democracy", "long-termism"],
    sections: {
      overview:
        "A standing assembly drawn by stratified lottery, rotated yearly, with power to delay or require review of legislation with long-term impact, supported by an independent evidence service.",
      motivation:
        "Elected governments optimise for short horizons, systematically discounting harms that land after the next election.",
    },
  });
  const registry = await propose("demo-sun", {
    title: "Open global registry of failed experiments",
    summary:
      "Researchers publish null and negative results to a shared, searchable registry so nobody wastes years repeating what didn't work.",
    topics: ["science"],
    tags: ["open science", "replication"],
    sections: {
      overview:
        "A lightweight, citable registry with structured fields (hypothesis, method, result, data link) where funders can require submission of results regardless of outcome.",
      motivation:
        "Publication bias hides null results; meta-analyses skew positive and research time is spent rediscovering approaches that already failed elsewhere.",
      prerequisites:
        "Buy-in from a few major funders and journals, persistent identifiers, and moderation that keeps quality high.",
    },
  });
  const commons = await propose("demo-lucia", {
    title: "Global open technology infrastructure",
    summary:
      "A shared public layer of designs, protocols and process knowledge that no nation or company needs to rediscover alone.",
    topics: ["economics", "technology"],
    tags: ["open hardware", "commons"],
    sections: {
      overview:
        "Open, versioned, liability-aware repositories of physical-technology designs and manufacturing process knowledge, maintained as a global commons.",
    },
  });
  const sunshade = await propose("demo-sun", {
    title: "Orbital sunshades at the Sun–Earth L1 point",
    summary:
      "A swarm of thin reflective sails at L1 deflecting a small fraction of sunlight as an emergency climate lever.",
    topics: ["space", "environment"],
    tags: ["climate", "geoengineering"],
    sections: {},
  });

  // ------------------------------------------------------------------ revision proposal accepted (attribution of development)
  const nanoDetail = nanorobots;
  const proposal = await ideasService.submitRevision(as["demo-teodor"], nanoDetail.id, {
    baseRevisionId: nanoDetail.revision.id,
    changeNote: "Add origins and an explicit challenges section",
    intent: "auto",
    content: {
      title: nanoDetail.title,
      summary: nanoDetail.summary,
      topics: nanoDetail.topics.map((t) => t.slug),
      tags: nanoDetail.tags,
      sections: {
        ...nanoDetail.sections,
        challenges:
          "Releasing self-propelled synthetic agents into open water could have hard-to-reverse consequences; contained, closed-loop deployment should come first. Membranes and activated carbon already address many cases at known cost.",
        origins:
          "Builds on decades of proposals for medical and environmental nanorobotics. The submitter is not the originator of the general concept.",
      },
    },
  });
  await ideasService.decideRevision(as["demo-mira"], nanoDetail.id, proposal.id, {
    decision: "accept",
    note: "Good additions — thank you.",
  });

  // ------------------------------------------------------------------ claims & evidence
  const recognition = await knowledge.addClaimToIdea(as["demo-mira"], nanorobots.id, {
    statement:
      "Engineered binding sites can selectively recognise specific classes of contaminant molecules.",
    role: "mechanism",
    assessment: { support: 4, plausibility: 4, confidence: "medium" },
  });
  // Anchor the narrative to the structured claim ("claim layers"): a steward publishes a new revision.
  const current = await getIdeaDetail(as["demo-mira"], nanorobots.id);
  await ideasService.submitRevision(as["demo-mira"], nanorobots.id, {
    baseRevisionId: current.revision.id,
    changeNote: "Link the recognition step to its claim",
    intent: "auto",
    content: {
      title: current.title,
      summary: current.summary,
      topics: current.topics.map((t) => t.slug),
      tags: current.tags,
      sections: {
        ...current.sections,
        overview: current.sections.overview!.replace(
          "recognising individual contaminant molecules",
          `[recognising individual contaminant molecules](claim:${recognition.id})`,
        ),
      },
    },
  });
  const energy = await knowledge.addClaimToIdea(as["demo-mira"], nanorobots.id, {
    statement:
      "Nanoscale devices can harvest enough energy from their surrounding medium to move autonomously.",
    role: "prerequisite",
    assessment: { support: 3, plausibility: 3 },
  });
  await knowledge.addClaimToIdea(as["demo-ana"], nanorobots.id, {
    statement: "Free-roaming synthetic micro-agents could disrupt aquatic food webs.",
    role: "risk",
    depth: 2,
    assessment: { support: 3, plausibility: 4 },
  });
  await knowledge.addClaimToIdea(as["demo-mira"], nanorobots.id, {
    statement: "Persistent pollutants would become removable at ecosystem scale.",
    role: "consequence",
    depth: 4,
  });
  const mechanosynthesis = await knowledge.addClaimToIdea(as["demo-teodor"], molecular.id, {
    statement: "Positional mechanosynthesis can operate reliably at useful rates.",
    role: "premise",
    assessment: { support: 3, plausibility: 4 },
  });
  // The energy-harvesting claim also underpins molecular manufacturing: one claim, shared across ideas.
  await knowledge.addClaimToIdea(as["demo-teodor"], molecular.id, {
    claimId: energy.id,
    role: "prerequisite",
  });
  const nullResults = await knowledge.addClaimToIdea(as["demo-sun"], registry.id, {
    statement: "Null and negative results are substantially under-published relative to positive results.",
    role: "premise",
    assessment: { support: 5, plausibility: 5, confidence: "high" },
  });

  for (const [who, value] of [
    ["demo-ana", 4],
    ["demo-sun", 4],
    ["demo-teodor", 3],
  ] as const) {
    await signals.submitEvaluation(as[who], {
      target: { kind: "claim", id: recognition.id },
      ratings: [{ dimension: "support", value }],
    });
  }
  for (const [who, value] of [
    ["demo-mira", 5],
    ["demo-ana", 1],
    ["demo-sun", 5],
    ["demo-lucia", 1],
  ] as const) {
    await signals.submitEvaluation(as[who], {
      target: { kind: "claim", id: mechanosynthesis.id },
      ratings: [{ dimension: "support", value }],
    });
  }
  for (const who of ["demo-ana", "demo-idris", "demo-lucia"] as const) {
    await signals.submitEvaluation(as[who], {
      target: { kind: "claim", id: nullResults.id },
      ratings: [{ dimension: "support", value: 5 }],
    });
  }

  await knowledge.attachEvidence(as["demo-ana"], recognition.id, {
    source: { kind: "report", title: `${ILLUSTRATIVE}: review of selective molecular recognition chemistry` },
    stance: "supports",
    summary:
      "Selective binding of target molecule classes by engineered sites is well characterised in bench chemistry.",
    limitations:
      "Does not establish that recognition works on a mobile, autonomous device, or in untreated water.",
  });
  await knowledge.attachEvidence(as["demo-teodor"], energy.id, {
    source: { kind: "preprint", title: `${ILLUSTRATIVE}: modelling energy budgets of micro-swimmers` },
    stance: "mixed",
    summary: "Models suggest chemical propulsion is possible but marginal at the smallest scales.",
    limitations: "Simulation only; assumptions about the medium may not hold in real water bodies.",
  });
  await knowledge.attachEvidence(as["demo-sun"], nullResults.id, {
    source: { kind: "dataset", title: `${ILLUSTRATIVE}: survey of result reporting across journals` },
    stance: "supports",
    summary: "Illustrates the kind of dataset that would document reporting bias.",
    limitations: "Illustrative record only; replace with real, verifiable sources.",
  });

  await knowledge.createArgument(as["demo-teodor"], {
    target: { kind: "idea", id: nanorobots.id },
    stance: "opposes",
    title: "Simpler alternatives exist for most cases",
    body: "Membranes, activated carbon and emission controls address most contamination today at known cost. The comparison belongs on the page.",
  });
  await knowledge.createArgument(as["demo-ana"], {
    target: { kind: "claim", id: mechanosynthesis.id },
    stance: "opposes",
    title: "Thermal noise and bonding errors",
    body: "At useful rates, positional errors and unwanted bonding may dominate. No error-correction scheme has been demonstrated.",
  });

  // ------------------------------------------------------------------ community evaluations & stances
  await rate(
    "demo-teodor",
    nanorobots,
    { impact: 5, feasibility: 1, evidence: 2, novelty: 4, development: 3 },
    "Enormous upside, very far off.",
  );
  await rate("demo-ana", nanorobots, { impact: 5, feasibility: 2, evidence: 2, plausibility: 3 });
  await rate("demo-sun", nanorobots, { impact: 4, feasibility: 2, evidence: 2 });
  await rate("demo-mira", molecular, { impact: 5, feasibility: 1, plausibility: 2 });
  await rate("demo-ana", molecular, { impact: 5, feasibility: 1, plausibility: 1 });
  await rate("demo-sun", molecular, { impact: 5, feasibility: 3, plausibility: 5 });
  await rate("demo-mira", bacteria, { impact: 4, feasibility: 3, evidence: 3 });
  await rate("demo-teodor", bacteria, { impact: 3, feasibility: 3, evidence: 3 });
  await rate("demo-lucia", registry, { impact: 4, feasibility: 5, evidence: 5, development: 4 });
  await rate("demo-ana", registry, { impact: 4, feasibility: 4, evidence: 4 });
  await rate("demo-idris", registry, { impact: 3, feasibility: 5, evidence: 4 });
  await rate("demo-lucia", assemblies, { impact: 4, feasibility: 4, evidence: 4 });
  await rate("demo-mira", assemblies, { impact: 3, feasibility: 4, evidence: 3 });
  await rate("demo-teodor", sunshade, { impact: 5, feasibility: 1 });
  await rate("demo-idris", commons, { impact: 4, feasibility: 3 });

  const everyone = PEOPLE.map((p) => p.handle);
  await stance(everyone, nanorobots, "important");
  await stance(["demo-teodor", "demo-sun", "demo-lucia"], molecular, "important");
  await stance(["demo-ana"], registry, "important");
  await stance(["demo-ana", "demo-lucia", "demo-idris"], registry, "worth_researching");
  await stance(["demo-ana", "demo-mira"], nanorobots, "worth_researching");
  await stance(["demo-teodor"], nanorobots, "doubtful");
  await stance(["demo-lucia", "demo-idris"], registry, "ready_now");

  // ------------------------------------------------------------------ graph
  await graph.proposeRelation(as["demo-teodor"], {
    fromIdeaId: nanorobots.id,
    toIdeaId: molecular.id,
    type: "requires",
    rationale: "Autonomous nanoscale devices need atomically precise fabrication at scale.",
  });
  await graph.proposeRelation(as["demo-ana"], {
    fromIdeaId: bacteria.id,
    toIdeaId: nanorobots.id,
    type: "alternative_to",
    rationale: "Both aim to remove persistent pollutants in situ.",
  });
  await graph.proposeRelation(as["demo-lucia"], {
    fromIdeaId: registry.id,
    toIdeaId: commons.id,
    type: "complements",
    rationale: "Shared failures and shared designs reduce duplicated effort together.",
  });
  await graph.proposeRelation(as["demo-lucia"], {
    fromIdeaId: commons.id,
    toIdeaId: molecular.id,
    type: "complements",
  });

  // ------------------------------------------------------------------ action in the world (illustrative records)
  await ideasService.transitionStage(as["demo-idris"], assemblies.id, {
    to: "developed",
    rationale: "Mechanism, mandate and selection method are written down.",
  });
  await ideasService.transitionStage(as["demo-idris"], assemblies.id, {
    to: "examined",
    rationale: "Independently evaluated by several contributors.",
  });
  const pilot = await practice.createInitiative(as["demo-idris"], assemblies.id, {
    kind: "pilot",
    title: "Illustrative municipal assembly pilot (demo record)",
    description:
      "A fictional record showing how a real pilot would be documented: a one-year lottery-selected panel advising a city council on a 30-year infrastructure plan.",
    organization: "Illustrative city council (fictional)",
    status: "active",
    startedOn: "2024-03-01",
  });
  await practice.recordOutcome(as["demo-idris"], pilot.id, {
    result: "partially_succeeded",
    summary:
      "Fictional outcome: recommendations were adopted in part; participation stayed high but evidence-service capacity was insufficient.",
    lessons:
      "Fund the independent evidence service before the assembly starts; deliberation quality depended on it more than on panel size.",
  });
  await practice.updateInitiativeStatus(as["demo-idris"], pilot.id, {
    status: "completed",
    on: "2025-03-01",
  });
  await ideasService.transitionStage(as["demo-idris"], assemblies.id, {
    to: "tested",
    rationale: "Pilot completed with a recorded outcome.",
    initiativeId: pilot.id,
  });

  await signals.declareInvolvement(as["demo-lucia"], registry.id, "funding", {
    status: "offering",
    note: "Small grant available for a prototype.",
  });
  await signals.declareInvolvement(as["demo-ana"], bacteria.id, "research", { status: "active" });
  await signals.declareInvolvement(as["demo-mira"], nanorobots.id, "engineering", { status: "offering" });

  await discussion.postComment(as["demo-idris"], nanorobots.id, {
    kind: "question",
    body: "Who authorises release once devices cross borders in shared rivers? The challenges section should address governance explicitly.",
  });

  console.info(
    `Demo data seeded: ${PEOPLE.length} people, 7 ideas. Log in as demo-mira@demo.ideaproxima.invalid / demo-password-123.`,
  );
}

await main();
