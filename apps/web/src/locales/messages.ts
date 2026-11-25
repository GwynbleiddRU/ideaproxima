import { STEWARD_ROLE_INFO } from "../../../../packages/domain/src/vocabulary/people";

// Shell labels appear in navigation and accessible names. Reuse the same ID across entry points.
export const englishMessages = {
  "brand.name": "ideaproxima",
  "nav.explore": "Explore",
  "nav.topics": "Topics",
  "nav.activity": "Activity",
  "nav.principles": "Principles",
  "nav.main": "Main",
  "nav.footer": "Footer",
  "nav.search": "Search",
  "nav.searchPlaceholder": "Search ideas, claims, people",
  "nav.searchLabel": "Search the archive",
  "nav.menu": "Menu",
  "nav.openMenu": "Open menu",
  "nav.skip": "Skip to content",
  "nav.home": "ideaproxima home",
  "nav.propose": "Propose an idea",
  "nav.account": "Your account",
  "nav.signedIn": "Signed in as <0>@{handle}</0>", // 0 isolates the account handle in bidirectional text.
  "nav.profile": "Your profile",
  "nav.settings": "Account settings",
  "nav.moderation": "Moderation log",
  "nav.signOut": "Sign out",
  "footer.description":
    "A persistent, open repository of humanity's possible futures. Facts are never rewritten; popularity is never mistaken for quality.",
  "footer.discover": "Discover",
  "footer.neglected": "Neglected ideas",
  "footer.archive": "Archive",
  "footer.build": "Build on it",
  "footer.api": "API",
  "footer.openApi": "OpenAPI",
  "theme.name": "Theme",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.useLight": "Switch to light theme",
  "theme.useDark": "Switch to dark theme",
  // Language picker controls and account preference status.
  "locale.label": "Display language",
  "locale.choose": "Choose a language",
  "locale.saveHint": "Saved with your account when you're signed in.",
  "locale.beta": "Beta",
  "locale.apply": "Apply language",
  "locale.close": "Close",
  "locale.failed": "Could not change the display language. Try again.",
  // Auth field labels, help and links. The 0 element in the switch prompts is a navigation link.
  "auth.signIn": "Sign in",
  "auth.welcome": "Welcome back",
  "auth.signInLede": "Sign in to contribute: take stances, evaluate, add evidence, propose ideas.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.newHere": "New here? <0>Create an account</0>",
  "auth.demo":
    "Local demo data (after <0>npm run db:seed:demo</0>): <1>demo-mira@demo.ideaproxima.invalid</1> / <2>demo-password-123</2>",
  "auth.join": "Join the archive",
  "auth.joinLede": "Your name and contributions are public and attributed. Your email is never shown.",
  "auth.name": "Name",
  "auth.handle": "Handle",
  "auth.handleHint": "Lowercase letters, digits and hyphens. Appears in your profile address.",
  "auth.passwordHint": "At least {count} characters.", // The minimum length from the domain rules.
  "auth.create": "Create account",
  "auth.haveAccount": "Already have an account? <0>Sign in</0>",
  "auth.title": "{title} · ideaproxima", // The current auth page title.
  "auth.network": "Could not reach the server. Check your connection and try again.",
  "auth.rateLimit": "Too many requests. Please wait a moment and try again.",
  // Standalone counts. Other screen copy enters the catalogue in phases C1 and C2.
  "count.claim": "{count, plural, one {# claim} other {# claims}}",
  "count.idea": "{count, plural, one {# idea} other {# ideas}}",
  "count.source": "{count, plural, one {# source} other {# sources}}",
  "count.initiative": "{count, plural, one {# initiative} other {# initiatives}}",
  "count.evaluator": "{count, plural, one {# evaluator} other {# evaluators}}",
  "count.moreEvaluation": "{count, plural, one {# more evaluation} other {# more evaluations}}",
  "count.otherIdea": "{count, plural, one {# other idea} other {# other ideas}}",
  "count.revision": "{count, plural, one {# proposed revision} other {# proposed revisions}}",
  "count.contributor": "{count, plural, one {# contributor} other {# contributors}}",

  // Shared interface labels, controls and numeric progress.
  "common.progress": "{count, number} of {total, number}", // Current and total, for a measure or stage.
  "common.cancel": "Cancel",
  "common.title": "Title",
  "common.hidden": "Hidden",
  "common.status": "Status",
  "common.note": "Note",
  "common.save": "Save",
  "common.withdrawn": "Withdrawn",
  "common.assess": "Assess",
  "common.withdraw": "Withdraw",

  // Labels and descriptions for the signal groups used by discovery lenses.
  "lensSignal.time.label": "Time",
  "lensSignal.time.description": "Ordered by when things happened.",
  "lensSignal.attention.label": "Attention",
  "lensSignal.attention.description": "What people care about. Popularity, not quality.",
  "lensSignal.quality.label": "Assessed quality",
  "lensSignal.quality.description": "Independent, multi-dimensional evaluations.",
  "lensSignal.uncertainty.label": "Uncertainty",
  "lensSignal.uncertainty.description": "Where knowledge is thin or contested.",
  "lensSignal.practice.label": "Practice",
  "lensSignal.practice.description": "What happened when ideas met the real world.",

  // Home hero headline, search and illustration labels.
  "home.hero.eyebrow": "An open archive of humanity's possible futures",
  "home.hero.title": "What could humanity <0>become?</0>", // 0 emphasises the final word.
  "home.hero.lede":
    "Ideas that could change what humanity can do, kept with the claims, evidence and connections behind them — so the people able to advance them can find them.",
  "home.hero.searchPlaceholder": "Search ideas and claims",
  "home.hero.searchShortcut": "Press / anywhere on this page to search",
  "home.hero.idea": "an idea",
  "home.hero.needs": "what it needs",
  "home.hero.enables": "what it enables",

  // Home title, lens showcase, topic tiles, contribution ladder and recent activity.
  "home.title": "ideaproxima · humanity's possible futures",
  "home.showcase.eyebrow": "Ways to discover",
  "home.showcase.title": "Many ways to look, never one ranking",
  "home.showcase.allLenses": "All lenses",
  "home.showcase.emptyTitle": "Nothing qualifies yet",
  "home.showcase.contestedEmpty":
    "An idea appears here when confident evaluators split widely on one of its dimensions.",
  "home.showcase.empty": "That is information too. As ideas are evaluated and tried, this lens fills.",
  "home.showcase.onlyIdea": "The only idea in this lens so far.",
  "home.showcase.seeAll": "See all: {lens}", // Lens is a vocabulary label.
  "home.showcase.early": "too early · {count, number} of {total, number}", // Current and required ratings.
  "home.showcase.potential":
    "{count, plural, one {# evaluator} other {# evaluators}} rated its potential {anchor} ({mean}).",
  "home.showcase.potentialEarly":
    "It needs {count, plural, one {# more evaluation} other {# more evaluations}} before its potential shows.",
  "home.showcase.neglected":
    "{attention, plural, =0 {Nobody has marked it important yet.} other {Only # marked it important.}} {potential} <0>Take a look</0>",
  "home.showcase.evidence":
    "Evaluators rate its evidence {anchor} ({mean}, n={evaluators, number}); {count, plural, one {# source} other {# sources}} on its claims.",
  "home.showcase.evidenceEarly":
    "{count, plural, one {# source} other {# sources}} on its claims; its evidence rating is still too early to tell.",
  "home.showcase.practice":
    "{count, plural, one {# initiative} other {# initiatives}} recorded — research, a pilot or a deployment — including how it went.",
  "home.showcase.contested": "Confident evaluators disagree widely on at least one of its dimensions.",
  "home.domains.eyebrow": "Or start from a domain",
  "home.domains.title": "Domains of possibility",
  "home.domains.first": "Be the first",
  "home.domains.surprise": "Surprise me",
  "home.domains.random": "A random idea",
  "home.ladder.stance": "Say what matters",
  "home.ladder.stanceCost": "One click",
  "home.ladder.stanceDescription":
    "Mark an idea important, worth researching, plausible or doubtful. Counted as attention — never as quality.",
  "home.ladder.stanceLink": "Browse ideas",
  "home.ladder.evaluateCost": "About two minutes",
  "home.ladder.evaluateDescription":
    "Rate only what you can judge; “I don't know” is always an answer. Three evaluations make a measure visible.",
  "home.ladder.evaluateLink": "Ideas that need review",
  "home.ladder.evidence": "Add evidence",
  "home.ladder.evidenceCost": "Ten minutes",
  "home.ladder.evidenceDescription":
    "Attach a source to a claim — and say what it does not establish. Evidence added once counts everywhere.",
  "home.ladder.evidenceLink": "Ideas with claims to examine",
  "home.ladder.proposeCost": "A title and a summary are enough",
  "home.ladder.proposeDescription":
    "It does not need to be feasible, proven or popular. Speculation is allowed; others can develop it.",
  "home.ladder.proposeLink": "Write it down",
  "home.ladder.eyebrow": "The unit of value is progression, not engagement",
  "home.ladder.title": "Move an idea forward — in a minute or an afternoon",
  "home.ladder.stages": "How an idea moves",
  "home.recent.label": "Happening now",
  "home.recent.newEyebrow": "Just proposed",
  "home.recent.newTitle": "Newest ideas",
  "home.recent.allNew": "All new",
  "home.recent.proposedBy": "Proposed by <0/> · <1/>", // 0 links to the proposer; 1 is the time.
  "home.recent.emptyTitle": "The archive is empty",
  "home.recent.first": "Propose the first idea",
  "home.recent.empty": "Every future starts with someone writing it down.",
  "home.recent.progressEyebrow": "The living record",
  "home.recent.progressTitle": "Latest progress",
  "home.recent.fullRecord": "Full record",
  "home.closing.label": "Why this exists",
  "home.closing.quote":
    "“Humanity should not lose a potentially valuable idea simply because the right person, technology or moment had not yet appeared.”",
  "home.closing.propose": "Propose a possibility",
  "home.closing.principles": "Read the principles",

  // Explore page title, lens rail, filter controls and result counts.
  "explore.lenses": "Lenses",
  "explore.allTopics": "All topics",
  "explore.title": "Explore ideas",
  "explore.documentTitle": "{lens} · Explore · ideaproxima", // Active lens label in the browser title.
  "explore.atLeast": "{count, number}+ ideas", // Loaded items when another page is available.
  "explore.lensDescription": "<0>{lens}</0> — {description}", // 0 emphasises the lens label.
  "explore.measureLegend":
    "Measures show the scale anchor nearest the mean, the mean and n (how many evaluators); the whisker is their spread. Under {minimum, number} evaluations a measure reads “too early” (●○○).",
  "explore.showCount": "Show {results}", // Results is the formatted result count.
  "explore.topicOption": "{topic} ({count, number})", // Localised topic label and its idea count.
  "explore.quotedWords": "“{words}”", // The reader's search query.
  "explore.removeFilter": "Remove {filter}", // Accessible name of a remove-filter button.
  "explore.lede":
    "Choose a lens — each one ranks on a single, named signal and says so. Narrow it with a topic or a stage.",
  "explore.results": "Results",
  "explore.filters": "Filters",
  "explore.emptyTitle": "No ideas match",
  "explore.clear": "Clear filters",
  "explore.empty":
    "Lenses based on assessments only include ideas with enough independent ratings. Try another lens, or help by evaluating ideas under “Needs review”.",
  "explore.more": "Show more",
  "explore.showResults": "Show results",
  "explore.words": "Words",
  "explore.wordsPlaceholder": "Filter by words in title or text",
  "explore.topic": "Topic",
  "explore.anyStage": "Any stage",

  // Idea actions and tabs.
  "idea.action.evaluate": "Evaluate",
  "idea.action.importantHint": "Mark it important. Counted as attention — never as quality.",
  "idea.action.edit": "Edit",
  "idea.action.suggestEdit": "Suggest an edit",
  "idea.action.updateEvaluation": "Update evaluation",
  "idea.action.help": "I can help",
  "idea.tabs.overview": "Overview",
  "idea.tabs.evidence": "Claims & evidence",
  "idea.tabs.discussion": "Discussion",
  "idea.tabs.connections": "Connections",
  "idea.tabs.practice": "In practice",
  "idea.tabs.history": "History",
  "idea.tabs.label": "Idea sections",

  // Idea header, attribution, mobile summary and revision metadata.
  "idea.stage": "Stage",
  "idea.layout.breadcrumb": "Breadcrumb",
  "idea.layout.documentTitle": "{title} · ideaproxima", // User-authored idea title.
  "idea.meta.proposedBy": "Proposed by <0/>", // 0 links to the proposer.
  "idea.layout.revision": "Revision {number, number} · updated <0/>", // 0 is the time.
  "idea.layout.revisionBy": "Revision {number, number} by <1/> · updated <0/>", // 1 links to the author.
  "idea.layout.hidden": "Hidden by moderation. Only moderators can see this idea; it remains in the record.",
  "idea.layout.glance": "At a glance",
  "idea.layout.known": "What is known",
  "idea.layout.noEvidence": "no evidence yet",

  // Rating and meter copy. Anchor is a vocabulary label. Mean is a formatted decimal.
  "idea.rating.meanAndCount": "{mean} · n={count, number}", // Formatted mean and number of evaluators.
  "idea.rating.early": "Too early",
  "idea.rating.earlySome": "Too early to tell",
  "idea.rating.earlyAll": "Too early to tell on every dimension",
  "idea.rating.updateYours": "Update your evaluation",
  "idea.rating.addYours": "Add your evaluation",
  "idea.rating.method":
    "Means of independent ratings on separate dimensions — never combined into one score. The whisker shows how much raters disagree. Fewer than {minimum, number} ratings is “too early to tell”. Computed by <0>{algorithm}</0>{dated, select, yes { ({date})} other {}}; a reputation-weighted method is planned and will be labelled.",
  "idea.rating.methodLabel": "How is this computed?",
  "idea.rating.progress": "{count, number} of {total, number} evaluations",
  "idea.rating.minimum":
    "{count, plural, one {# evaluation makes a measure.} other {# evaluations make a measure.}}",
  "idea.rating.summary":
    "{count, plural, one {# evaluator} other {# evaluators}} · {completeness} of sections written",
  "idea.rating.accessibleValue": "{anchor} {mean}, {count, plural, one {# rating} other {# ratings}}",
  "meter.name": "Measure",
  "meter.unrated": "Not yet rated",
  "meter.unratedHint": "{name}: nobody has rated this yet",
  "meter.early": "Too early · {count, number} of {total, number}",
  "meter.earlyHint":
    "{name}: too early to tell — {count, number} of the {total, number} evaluations a measure needs",
  "meter.earlyAccessible": "{count, number} of {total, number} evaluations, too early to tell",
  "meter.sampleSize": " · n={count, number}",

  // Narrative and sidebar cards. Counts refer to sections, assessments or evidence records.
  "idea.overview.missingLabel": "Not yet written",
  "idea.overview.missingHelp":
    "Speculation is allowed; incomplete ideas are welcome. Anyone can propose the missing parts.",
  "idea.overview.develop": "Help develop this idea",
  "idea.overview.signals": "Signals",
  "idea.overview.lifecycle": "Lifecycle stage",
  "idea.overview.noClaims": "No claims recorded yet. Claims make an idea examinable.",
  "idea.overview.noEvidence": "No evidence attached yet.",
  "idea.overview.perspectives": "Perspectives",
  "idea.overview.perspectivesLabel": "What are perspectives?",
  "idea.overview.perspectivesHelp":
    "Quick stances anyone can take. They show what people care about and believe — attention, not quality — and never feed the assessed measures above.",
  "idea.overview.yourPerspective": "Your perspective",
  "idea.overview.perspectivesCaption": "Community judgments, not objective truth. Tick the ones you share.",
  "idea.overview.people": "People",
  "idea.overview.stewardsLabel": "What do stewards do?",
  "idea.overview.stewardsHelp":
    "Stewards curate the narrative: they publish revisions directly and decide on proposed ones. Anyone can propose a revision; everything stays in the history.",
  "idea.overview.helpToo": "I can help too",
  "idea.overview.stewardPlaceholder": "Appoint a steward by handle",
  "idea.overview.stewardHandle": "Handle of the person to appoint as steward",
  "idea.overview.appoint": "Appoint",
  "idea.quadrant.visionary": "Visionary",
  "idea.quadrant.visionaryDescription": "High potential, far from feasible today.",
  "idea.quadrant.near": "Transformative and near",
  "idea.quadrant.nearDescription": "High potential, and feasible soon.",
  "idea.quadrant.incremental": "Incremental",
  "idea.quadrant.incrementalDescription": "Feasible, with modest potential.",
  "idea.quadrant.longShot": "Long shot",
  "idea.quadrant.longShotDescription": "Modest potential, far from feasible.",
  "idea.overview.writtenProgress": "Not yet written · {count, number} of {total, number} sections done",
  "idea.quadrant.reading": "{reading} Potential ↑, feasibility →.", // Reading describes the plotted quadrant.
  "idea.overview.evidenceBalance":
    "{count, plural, one {# source} other {# sources}}: {supporting, number} supporting, {challenging, number} challenging.",
  "idea.overview.stewardRole": "Steward · {role}", // Role is the localised steward role.
  "idea.overview.stewardRole.originator": STEWARD_ROLE_INFO.originator.label.toLowerCase(),
  "idea.overview.stewardRole.steward": STEWARD_ROLE_INFO.steward.label.toLowerCase(),
  "idea.markdown.claim": "Claim", // Tooltip for a claim anchor without a loaded statement.
  "idea.markdown.claimTitle": "{status} claim: {statement}", // Vocabulary status and user-authored statement.

  // Evidence tab and its claim groups. Group headings stay plural regardless of count.
  "idea.evidence.eyebrow": "What the idea rests on",
  "idea.evidence.addClaim": "Add a claim",
  "idea.evidence.emptyTitle": "No claims yet",
  "idea.evidence.firstClaim": "State the first claim",
  "idea.evidence.empty":
    "Break the idea into the premises, mechanisms and prerequisites it depends on. That is what makes it examinable.",
  "idea.evidence.glance": "Claims at a glance",
  "idea.evidence.noEvidence": "No evidence attached yet",
  "idea.evidence.statusHelp":
    "A claim's status is derived from independent assessments, never typed in. Evidence added to a claim counts on every idea that uses it.",
  "idea.evidence.group.premise": "Premises",
  "idea.evidence.group.mechanism": "Mechanisms",
  "idea.evidence.group.prerequisite": "Prerequisites",
  "idea.evidence.group.consequence": "Consequences",
  "idea.evidence.group.risk": "Risks",
  "idea.evidence.balance":
    "{count, plural, one {# source} other {# sources}} · {supporting, number} supporting · {challenging, number} challenging",

  // Debate columns, comment composer and discussion controls.
  "idea.discussion.for": "For it",
  "idea.discussion.noFor": "No argument for it yet.",
  "idea.discussion.argueFor": "Argue for it",
  "idea.discussion.against": "Against it",
  "idea.discussion.noAgainst": "No argument against it yet.",
  "idea.discussion.argueAgainst": "Argue against it",
  "idea.discussion.debate": "Structured debate",
  "idea.discussion.arguments": "Arguments",
  "idea.discussion.makeArgument": "Make an argument",
  "idea.discussion.comments": "Comments",
  "idea.discussion.noComments": "No comments yet",
  "idea.discussion.commentInvite": "Ask a question, suggest an improvement, or point to related work.",
  "idea.discussion.moreComments": "Load more comments",
  "idea.discussion.addComment": "Add a comment, question or suggestion…",
  "idea.discussion.kind": "Kind of comment",
  "idea.discussion.replyPlaceholder": "Write a reply…",
  "idea.discussion.commentPlaceholder": "Share a thought, a question or a suggestion…",
  "idea.discussion.reply": "Reply",
  "idea.discussion.hidden": "Hidden by moderation. The reason is in the public moderation log.",
  "idea.discussion.conversation": "Conversation",
  "idea.discussion.kind.comment": "Comment",
  "idea.discussion.kind.question": "Question",
  "idea.discussion.kind.suggestion": "Suggestion",
  "idea.discussion.post": "Post",

  // Relation controls and graph. Relation is a vocabulary phrase. From and to are idea titles.
  "idea.connections.title": "Connected ideas",
  "idea.connections.connect": "Connect to another idea",
  "idea.connections.directionsHelp":
    "Upstream: what this idea builds on and needs first. Downstream: what builds on it, everything that becomes reachable once it is realised.",
  "idea.connections.both": "Both directions",
  "idea.connections.upstream": "What it needs",
  "idea.connections.downstream": "What it enables",
  "idea.connections.emptyTitle": "No connections in this direction yet",
  "idea.connections.empty":
    "Does this idea require another? Is it an application of one? Connecting ideas lets someone who realises one find everything else it unlocks.",
  "idea.connections.accurate": "Is this accurate?",
  "idea.connections.retract": "Retract",
  "idea.connections.describe": "Say exactly how the two ideas relate.",
  "idea.connections.otherIdea": "The other idea",
  "idea.connections.searchPlaceholder": "Search by title or text",
  "idea.connections.search": "Search ideas",
  "idea.connections.type": "How they relate",
  "idea.connections.direction": "Direction of the relation",
  "idea.connections.rationaleHint": "A sentence that would convince a sceptical reader.",
  "idea.connections.record": "Record connection",
  "idea.connections.filterDirection": "Direction",
  "idea.connections.depth": "Depth",
  "idea.connections.steps": "{count, plural, one {# step} other {# steps}}",
  "idea.connections.group": "This idea {relation}",
  "idea.connections.sentence": "“{from}” {relation} “{to}”",
  "idea.connections.forward": "This idea {relation} the other",
  "idea.connections.reverse": "The other {relation} this idea",
  "idea.connections.why": "Why",
  "idea.graph.focus": "This idea",
  "idea.graph.empty": "Nothing recorded builds on it yet.",
  "idea.graph.invite": "Know an idea it would enable? Connect it.",
  "idea.graph.buildsOn": "builds on (requires, applies, extends, derived from)",
  "idea.graph.alternative": "alternative or complement",
  "idea.graph.conflicts": "conflicts with",
  "idea.graph.stepsBack": "{count, plural, one {# step back} other {# steps back}}",
  "idea.graph.stepsOn": "{count, plural, one {# step on} other {# steps on}}",
  "idea.graph.label":
    "Connection map: {ideas, plural, one {# idea} other {# ideas}}, {connections, plural, one {# connection} other {# connections}}",
  "idea.graph.edge": "{label}: {description}", // Vocabulary label and description of the relation.

  // Involvements, initiatives and outcomes. In attribution, 0 is the person link and 1 is the time.
  "idea.practice.peopleEyebrow": "Who can carry it forward",
  "idea.practice.people": "People involved",
  "idea.practice.noPeople": "Nobody has stepped forward yet",
  "idea.practice.peopleInvite":
    "Researchers, engineers, funders and organisers can say how they could help, so they can find each other.",
  "idea.practice.initiativesEyebrow": "Research, experiments, pilots, deployments",
  "idea.practice.initiatives": "Initiatives & outcomes",
  "idea.practice.create": "Record an initiative",
  "idea.practice.noInitiatives": "No initiatives recorded",
  "idea.practice.initiativeInvite":
    "When someone researches, tests or deploys this idea — successfully or not — record it here. An experiment with a recorded outcome is what moves an idea to “Tested”.",
  "idea.practice.website": "Website",
  "idea.practice.lessonsLabel": "What was learned:",
  "idea.practice.updateStatus": "Update status",
  "idea.practice.recordOutcome": "Record outcome",
  "idea.practice.createHelp":
    "Real-world action on this idea. Past initiatives can be recorded as completed.",
  "idea.practice.kind": "Kind",
  "idea.practice.description": "What is being done, and how",
  "idea.practice.organisation": "Organisation",
  "idea.practice.started": "Started",
  "idea.practice.ended": "Ended",
  "idea.practice.submitInitiative": "Record initiative",
  "idea.practice.effectiveDate": "Effective date",
  "idea.practice.outcomeTitle": "Record an outcome",
  "idea.practice.result": "Result",
  "idea.practice.summary": "What happened",
  "idea.practice.lessons": "What was learned",
  "idea.practice.lessonsHint":
    "Required later to move the idea to “Learned from”. The most valuable part of a failure.",
  "idea.practice.outcomeBy": "recorded by <0/> · <1/>",
  "idea.practice.recordedBy": "Recorded by <0/>",

  // Revision, stage and timeline history. Numbers identify revisions or count list entries.
  "idea.history.proposedEyebrow": "Awaiting a steward's decision",
  "idea.history.stageEyebrow": "What has been done",
  "idea.history.stages": "Stage history",
  "idea.history.revisionsEyebrow": "How the text evolved",
  "idea.history.initial": "Initial version",
  "idea.history.view": "View changes",
  "idea.history.decide": "Decide",
  "idea.history.withdraw": "Withdraw proposal",
  "idea.history.decisionHelp":
    "Accepting publishes it as the current text, crediting its author. Either way, the proposal and your note stay in the history.",
  "idea.history.note": "Note to the author",
  "idea.history.decline": "Decline",
  "idea.history.accept": "Accept and publish",
  "idea.history.noChanges": "No textual changes",
  "idea.history.textAndStage": "Text & stage",
  "idea.history.knowledgeAndDebate": "Knowledge & debate",
  "idea.history.evaluationsAndPerspectives": "Evaluations & perspectives",
  "idea.history.activityEyebrow": "Every recorded action",
  "idea.history.noActivity": "Nothing of this kind is recorded yet.",
  "idea.history.older": "Older entries",
  "idea.history.proposedCount": "Proposed revisions ({count, number})",
  "idea.history.revisionCount": "Revisions ({count, number})",
  "idea.history.revisionNumber": "#{number, number}",
  "idea.history.revisionTitle": "Revision #{number, number}",
  "idea.history.current": "Current",
  "idea.history.transition": "{from} → <0>{to}</0>", // Lifecycle stage names; 0 emphasises the new stage.
  "idea.history.firstStage": "<0>{to}</0>", // Initial recorded stage.
  "idea.history.decidedBy": "{status} by <0/>", // 0 links to the deciding steward.
  "idea.history.decidedWithNote": "{status} by <0/> — “<1/>”", // 1 is the user-authored decision note.
  "idea.history.summary": "Summary",
  "idea.history.tags": "Tags",
  "idea.history.compared":
    "Compared with revision {number, number}. Added lines are marked +, removed lines −.",
  "idea.history.firstDiff":
    "The first version: everything is new. Added lines are marked +, removed lines −.",
  "idea.history.everything": "Everything",
  "idea.history.practice": "Practice",
  "idea.history.timeline": "Timeline",
  "idea.history.show": "Show",

  // Discovery cards. 0 is the relative time and counts are recorded signals.
  "idea.card.potential": "Potential",
  "idea.card.attentionHint": "People who marked this important. Popularity — not quality.",
  "idea.card.claimsHint": "Claims this idea rests on",
  "idea.card.discussionHint": "Arguments and comments",
  "idea.card.practiceHint": "Research, experiments, pilots or deployments",
  "idea.card.updated": "updated <0/>",
  "idea.card.proposed": "proposed <0/>",
  "idea.card.importantCount": "{count, number} marked it important",
  "idea.card.discussionCount": "{count, number} in discussion",
  "idea.card.evidenceHint":
    "Evidence on its claims: {supporting, number} supporting, {challenging, number} challenging",

  // Lifecycle progress. The proof requirement comes from the domain.
  "idea.stageProgress.last": "The last stage: learning recorded from practice.",
  "idea.stageProgress.track": "Stage {count, number} of {total, number}: {stage}",
  "idea.stageProgress.ready":
    "<0>{stages}</0>: {count, plural, one {requirement} other {requirements}} met — a steward can move it on.",
  "idea.stageProgress.next": "Next proof, for <0>{stage}</0>: {requirement}",

  // Claim, evidence and argument cards. Counts refer to evidence records or replies as named.
  "idea.argument.respond": "Respond",
  "idea.argument.withdrawTitle": "Withdraw this argument",
  "idea.argument.withdrawHelp": "It stays in the discussion, marked as withdrawn.",
  "idea.argument.reply": "Your response",
  "idea.argument.write": "Your argument",
  "idea.argument.title": "In one line",
  "idea.argument.reasoning": "Reasoning",
  "idea.argument.reasoningHint": "Make the strongest version of the case. Cite evidence where you can.",
  "idea.argument.post": "Post argument",
  "idea.claim.attach": "Attach evidence",
  "idea.claim.open": "Claim page",
  "idea.claim.unlink": "Unlink",
  "idea.claim.subject": "this claim",
  "idea.claim.noEvidence": "No evidence yet",
  "idea.claim.evidenceInvite":
    "A claim without evidence is a hypothesis. Attach a study, dataset, or a recorded outcome.",
  "idea.claim.recordedOutcome": "Recorded outcome",
  "idea.claim.limitations": "Does not establish:",
  "idea.claim.doi": "DOI",
  "idea.claim.link": "Link",
  "idea.claim.evidenceSubject": "this evidence",
  "idea.claim.withdrawTitle": "Withdraw this evidence",
  "idea.claim.withdrawHelp":
    "It stays in the record, marked as withdrawn, and stops counting towards the claim's status.",
  "idea.argument.useful": "Useful",
  "idea.argument.usefulCount": "Useful · {count, number}",
  "idea.argument.showResponses": "{count, plural, one {Show # response} other {Show # responses}}",
  "idea.argument.hideResponses": "{count, plural, one {Hide # response} other {Hide # responses}}",
  "idea.claim.supporting": "{count, number} supporting",
  "idea.claim.challenging": "{count, number} challenging",
  "idea.claim.mixed": "{count, number} mixed",
  "idea.claim.alsoUnderpins":
    "{count, plural, one {Also underpins # other idea} other {Also underpins # other ideas}}",
  "idea.claim.evidenceCount": "Evidence ({count, number})",
  "idea.claim.addedBy": "Added by <0/>", // 0 links to the contributor.
  "idea.claim.outcomeSource": "From an outcome recorded on the platform: {result}.", // A vocabulary label.
  "idea.claim.withdrawnReason": "Withdrawn: {reason}", // The contributor's recorded reason.
  "idea.claim.citationDetail": " · {detail}", // Bibliographic metadata or a locator after a source title.
} as const;

export type MessageId = keyof typeof englishMessages;

// Small beta fixtures for the web localization audit. Full translated catalogues are phase D.
export const translatedMessages = {
  ar: {
    "nav.explore": "استكشف",
    "nav.topics": "الموضوعات",
    "nav.activity": "النشاط",
    "nav.principles": "المبادئ",
    "nav.main": "القائمة الرئيسية",
    "nav.footer": "التذييل",
    "nav.search": "بحث",
    "nav.openMenu": "افتح القائمة",
    "nav.menu": "القائمة",
    "nav.skip": "انتقل إلى المحتوى",
    "nav.propose": "اقترح فكرة",
    "locale.label": "لغة العرض",
    "locale.choose": "اختر لغة",
    "locale.apply": "تطبيق اللغة",
    "locale.close": "إغلاق",
    "locale.beta": "تجريبية",
    "theme.useLight": "التبديل إلى المظهر الفاتح",
    "theme.useDark": "التبديل إلى المظهر الداكن",
    "auth.signIn": "تسجيل الدخول",
    "auth.welcome": "مرحبًا بعودتك",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.network": "تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.",
    "auth.rateLimit": "طلبات كثيرة جدًا. انتظر قليلًا وحاول مرة أخرى.",
    "count.claim":
      "{count, plural, zero {لا ادعاءات} one {ادعاء واحد} two {ادعاءان} few {# ادعاءات} many {# ادعاءً} other {# ادعاء}}",
    "home.hero.title": "ماذا يمكن أن تصبح <0>البشرية؟</0>",
    "home.hero.searchPlaceholder": "ابحث في الأفكار والادعاءات",
    "explore.title": "استكشف الأفكار",
    "explore.filters": "عوامل التصفية",
    "explore.results": "النتائج",
    "idea.tabs.label": "أقسام الفكرة",
    "idea.tabs.overview": "نظرة عامة",
    "idea.tabs.evidence": "الادعاءات والأدلة",
    "idea.tabs.discussion": "النقاش",
    "idea.tabs.connections": "الروابط",
    "idea.tabs.practice": "في الواقع",
    "idea.tabs.history": "السجل",
    "lensSignal.quality.label": "الجودة المقدّرة",
    "idea.evidence.glance": "الادعاءات في لمحة",
    "idea.discussion.arguments": "الحجج",
    "idea.practice.initiatives": "المبادرات والنتائج",
    "idea.history.stages": "سجل المراحل",
    "idea.connections.steps":
      "{count, plural, zero {لا خطوات} one {خطوة واحدة} two {خطوتان} few {# خطوات} many {# خطوة} other {# خطوة}}",
  },
  ru: { "nav.explore": "Обзор", "locale.label": "Язык интерфейса", "auth.signIn": "Войти" },
  ja: { "nav.explore": "探索", "locale.label": "表示言語", "auth.signIn": "ログイン" },
  hi: { "nav.explore": "खोजें", "locale.label": "प्रदर्शन की भाषा", "auth.signIn": "साइन इन करें" },
} satisfies Partial<Record<string, Partial<Record<MessageId, string>>>>;
