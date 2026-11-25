import { STEWARD_ROLE_INFO } from "../../../../packages/domain/src/vocabulary/people";

// Shell labels appear in navigation and accessible names. Reuse the same ID across entry points.
export const englishMessages = {
  "brand.name": "ideaproxima",
  "bootstrap.noScript": "ideaproxima needs JavaScript. The archive is also available as an API at /v1.",
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
  "error.retryAfter":
    "Too many requests. Please wait {seconds, plural, one {# second} other {# seconds}} before trying again.",
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
  "common.doiExample": "10.1000/xyz123",
  "common.urlExample": "https://",
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

  // Principles page and its vocabulary examples.
  "about.title": "A collective memory of humanity's attempts to imagine its future",
  "about.lede":
    "ideaproxima connects ideas with the people capable of advancing them: the scientist who finds a direction worth researching, the engineer a concept worth building, the funder an opportunity worth backing.",
  "about.whatHasBeenDone": "What has been done",
  "about.sixLifecycleStages": "Six lifecycle stages",
  "about.stagesDescription":
    "The unit of value is progression. Later stages require proof: a recorded experiment, deployment or outcome. The stage says what was done, not what is known.",
  "about.whatIsKnown": "What is known",
  "about.howClaimsAreJudged": "How claims are judged",
  "about.claimsDescription":
    "Ideas rest on claims. A claim's status is derived from independent assessments and the evidence attached to it. It is never typed in by anyone.",
  "about.howToDiscover": "How to discover",
  "about.lensesTitle": "Lenses instead of one ranking",
  "about.lensesDescription":
    "The current measures are a transparent baseline. A reputation-weighted system, where people who have shown good judgment in a domain count for more there, is planned. It will be labelled wherever it is used.",
  "about.startExploring": "Start exploring",
  "about.openApiOpenapi3": "Open API (OpenAPI 3.1)",
  "about.principle.ideas.deserve.title": "Ideas deserve preservation",
  "about.principle.ideas.deserve.body":
    "An idea does not need to be feasible, proven or popular to be kept. Some are developed decades before the technology or social conditions they need exist.",
  "about.principle.popularity.is.title": "Popularity is not quality",
  "about.principle.popularity.is.body":
    "Attention shows what people care about. It never decides what is true, feasible or valuable, and it is never blended into the assessed measures.",
  "about.principle.uncertainty.stays.title": "Uncertainty stays visible",
  "about.principle.uncertainty.stays.body":
    "Ratings show their spread and their number. Below {count, number} independent ratings, a measure says “too early to tell”. Absence of data is never shown as a low score.",
  "about.principle.facts.are.title": "Facts are never rewritten",
  "about.principle.facts.are.body":
    "Revisions, ratings, evidence and stage changes are append-only. Corrections supersede; withdrawals are marked; moderation hides but never deletes, and is logged publicly.",
  "about.principle.knowledge.not.title": "Knowledge, not posts",
  "about.principle.knowledge.not.body":
    "Ideas are made of shared claims, evidence with stated limitations, arguments, typed connections to other ideas, and recorded real-world initiatives, including failures.",
  "about.principle.contribution.not.title": "Contribution, not hierarchy",
  "about.principle.contribution.not.body":
    "Reputation will reflect demonstrated contribution: useful criticism, evidence, accurate judgment. It is a measure of contribution, never of intelligence.",

  // Account settings. The handle and email identify the signed-in reader.
  "account.account": "Account",
  "account.public": "Public",
  "account.profile": "Profile",
  "account.displayName": "Display name",
  "account.affiliation": "Affiliation",
  "account.aboutYou": "About you",
  "account.howYouCanHelp": "How you can help advance ideas",
  "account.saveProfile": "Save profile",
  "account.domains": "Domains",
  "account.expertise": "Expertise",
  "account.expertiseDescription": "Self-declared until verified by a moderator. Shown on your profile.",
  "account.verifiedBadge": "Verified",
  "account.selfDeclared": "Self-declared",
  "account.chooseATopic": "Choose a topic",
  "account.basis": "Basis",
  "account.expertiseBasisHint": "Degree, role, years of practice…",
  "account.declareExpertise": "Declare expertise",
  "account.security": "Security",
  "account.currentPassword": "Current password",
  "account.newPassword": "New password",
  "account.changePassword": "Change password",
  "account.signedInEmail": "Signed in as @{handle} ({email}). Your profile is public; your email is not.",
  "account.signedIn": "Signed in as @{handle}. Your profile is public; your email is not.",
  "account.removeExpertise": "Remove {topic}",

  // Ledger sentences. In event messages, 0 is the idea subject and 1 is a quote or emphasized vocabulary. In withActors, 0 is the actor list and 1 is the full event.
  "activity.hidden": "contributed content hidden by moderation",
  "activity.unknown": "{action}{hasIdea, select, yes { in <0/>} other {}}",
  "activity.anIdea": "an idea",
  "activity.theIdea": "the idea",
  "activity.operator": "An operator",
  "activity.otherActors": "{count, plural, one {# other} other {# others}}",
  "activity.withActors": "<0/> <1/>",
  "activity.evaluation.idea": "evaluated <0/>{hasDimensions, select, yes { on {dimensions}} other {}}",
  "activity.evaluation.target":
    "assessed {target, select, relation {a connection} evidence {evidence} claim {a claim} other {{target}}}{hasIdea, select, yes { in <0/>} other {}}",
  "activity.idea.proposed": "proposed <0/>",
  "activity.revision.published":
    "published revision {number, number}{hasIdea, select, yes { of <0/>} other {}}{hasQuote, select, yes { <1/>} other {}}",
  "activity.revision.proposed":
    "proposed revision {number, number}{hasIdea, select, yes { of <0/>} other {}}{hasQuote, select, yes { <1/>} other {}}",
  "activity.revision.accepted":
    "accepted revision {number, number}{hasIdea, select, yes { of <0/>} other {}}",
  "activity.revision.rejected":
    "declined revision {number, number}{hasIdea, select, yes { of <0/>} other {}}",
  "activity.revision.withdrawn":
    "withdrew revision {number, number}{hasIdea, select, yes { of <0/>} other {}}",
  "activity.stage.changed": "moved <0/> to <1>{stage}</1>",
  "activity.steward.appointed": "appointed a steward{hasIdea, select, yes { for <0/>} other {}}",
  "activity.claim.stated":
    "stated a claim{hasIdea, select, yes { on <0/>} other {}}{hasQuote, select, yes {: <1/>} other {}}",
  "activity.claim.linked":
    "linked {count, plural, one {a claim} other {# claims}} as {role}{hasIdea, select, yes { in <0/>} other {}}",
  "activity.claim.unlinked": "unlinked a claim{hasIdea, select, yes { from <0/>} other {}}",
  "activity.evidence.attached":
    "{stance, select, supports {attached {count, plural, one {supporting evidence} other {# supporting sources}}} challenges {attached {count, plural, one {challenging evidence} other {# challenging sources}}} other {attached {count, plural, one {mixed evidence} other {# mixed sources}}}} to a claim{hasIdea, select, yes { in <0/>} other {}}",
  "activity.evidence.withdrawn": "withdrew evidence{hasIdea, select, yes { in <0/>} other {}}",
  "activity.source.registered": "registered a source{hasQuote, select, yes { <1/>} other {}}",
  "activity.argument.made":
    "{stance, select, supports {argued for} opposes {argued against} other {qualified}} {target, select, idea {<0/>} claim {a claim{hasIdea, select, yes { in <0/>} other {}}} evidence {evidence{hasIdea, select, yes { in <0/>} other {}}} relation {a relation{hasIdea, select, yes { in <0/>} other {}}} other {{target}{hasIdea, select, yes { in <0/>} other {}}}}{hasQuote, select, yes {: <1/>} other {}}",
  "activity.argument.withdrawn": "withdrew an argument{hasIdea, select, yes { on <0/>} other {}}",
  "activity.evaluation.withdrawn": "withdrew ratings{hasIdea, select, yes { on <0/>} other {}}",
  "activity.stance.taken": "marked <0/> {stance}",
  "activity.stance.retracted": "retracted a perspective{hasIdea, select, yes { on <0/>} other {}}",
  "activity.involvement.declared":
    "{status, select, active {started working on <0/> ({capacity})} concluded {concluded their involvement{hasIdea, select, yes { in <0/>} other {}}} other {offered to help with <1>{capacity}</1>{hasIdea, select, yes { on <0/>} other {}}}}",
  "activity.involvement.withdrawn": "ended their involvement{hasIdea, select, yes { in <0/>} other {}}",
  "activity.relation.proposed": "connected <0/> to another idea{hasType, select, yes { ({type})} other {}}",
  "activity.relation.retracted": "retracted a connection{hasIdea, select, yes { of <0/>} other {}}",
  "activity.initiative.created":
    "recorded an initiative{hasIdea, select, yes { on <0/>} other {}}{hasQuote, select, yes {: <1/>} other {}}",
  "activity.initiative.status_changed":
    "marked an initiative {status}{hasIdea, select, yes { on <0/>} other {}}",
  "activity.outcome.recorded":
    "recorded an outcome — <1>{result}</1>{lessons, select, yes {, with lessons} other {}}{hasIdea, select, yes { for <0/>} other {}}",
  "activity.comment.posted":
    "{kind, select, question {{count, plural, one {asked a question} other {asked questions}}} suggestion {{count, plural, one {made a suggestion} other {made suggestions}}} other {commented}}{hasIdea, select, yes { on <0/>} other {}}",
  "activity.topic.created": "created the topic “{topic}”",
  "activity.topic.translation_updated": "updated the {locale} translation of “{topic}”",
  "activity.person.registered": "joined the archive",
  "activity.person.profile_updated": "updated their profile",
  "activity.person.role_changed": "role changed from {from} to {to}",
  "activity.expertise.declared": "declared expertise in {topic}",
  "activity.expertise.revoked": "withdrew expertise in {topic}",
  "activity.moderation.hidden":
    "hid content{hasIdea, select, yes { in <0/>} other {}}{hasQuote, select, yes { — <1/>} other {}}",
  "activity.moderation.restored":
    "restored content{hasIdea, select, yes { in <0/>} other {}}{hasQuote, select, yes { — <1/>} other {}}",
  "activity.moderation.person_deactivated":
    "deactivated an account{hasQuote, select, yes { — <1/>} other {}}",
  "activity.moderation.person_reactivated":
    "reactivated an account{hasQuote, select, yes { — <1/>} other {}}",

  // Ledger page heading, action filters and pagination.
  "activityPage.moderationLede":
    "Every hide, restore, deactivation and reactivation, with the moderator and the reason. Hidden content is never deleted.",
  "activityPage.activityLede":
    "Every contribution is recorded and nothing is rewritten — the archive's memory of how ideas progress.",
  "activityPage.filterTheRecord": "Filter the record",
  "activityPage.show": "Show",
  "activityPage.theRecord": "The record",
  "activityPage.moderationEmpty": "No moderation actions yet",
  "activityPage.activityEmpty": "Nothing recorded yet",
  "activityPage.olderEntries": "Older entries",
  "activityPage.filter.everything": "Everything",
  "activityPage.filter.ideas": "Ideas",
  "activityPage.filter.newIdeas": "New ideas",
  "activityPage.filter.revisions": "Revisions",
  "activityPage.filter.stageChanges": "Stage changes",
  "activityPage.filter.knowledge": "Knowledge",
  "activityPage.filter.claims": "Claims",
  "activityPage.filter.evidence": "Evidence",
  "activityPage.filter.arguments": "Arguments",
  "activityPage.filter.connections": "Connections",
  "activityPage.filter.judgement": "Judgement",
  "activityPage.filter.evaluations": "Evaluations",
  "activityPage.filter.practice": "Practice",
  "activityPage.filter.initiatives": "Initiatives",
  "activityPage.filter.outcomes": "Outcomes",
  "activityPage.filter.transparency": "Transparency",
  "activityPage.filter.moderationLog": "Moderation log",

  // Dialog for stating a claim or linking an existing one.
  "addClaim.title": "Add a claim",
  "addClaim.description":
    "A claim is one statement the idea depends on, phrased so that evidence could support or challenge it.",
  "addClaim.newOrExistingClaim": "New or existing claim",
  "addClaim.stateANewClaim": "State a new claim",
  "addClaim.linkAnExistingClaim": "Link an existing claim",
  "addClaim.statement": "Statement",
  "addClaim.statementHint":
    "One checkable statement. “Membranes can selectively capture microplastics below 5 µm”, not “this will work”.",
  "addClaim.findTheClaim": "Find the claim",
  "addClaim.searchClaimStatements": "Search claim statements",
  "addClaim.searchClaims": "Search claims",
  "addClaim.noMatches": "No claims match. State a new one instead.",
  "addClaim.itsRoleInThis": "Its role in this idea",
  "addClaim.consequenceDepth": "How far down the chain of consequences?",
  "addClaim.yourOwnAssessment": "Your own assessment",
  "addClaim.assessmentHint": "Optional. Recorded as an ordinary, attributed evaluation of the claim.",
  "addClaim.confidence": "Confidence",
  "addClaim.addClaim": "Add claim",
  "addClaim.usage": "{count, plural, one {Used by # idea} other {Used by # ideas}}",

  // Evidence form. The claim is contributed text and source details are bibliographic.
  "addEvidence.stance": "What does it do to the claim?",
  "addEvidence.basis": "Basis",
  "addEvidence.aPublicationOrSource": "A publication or source",
  "addEvidence.anOutcomeRecordedHere": "An outcome recorded here",
  "addEvidence.kindOfSource": "Kind of source",
  "addEvidence.year": "Year",
  "addEvidence.authors": "Authors",
  "addEvidence.journalPublisherOrVenue": "Journal, publisher or venue",
  "addEvidence.deduplicationHint": "A known DOI or URL reuses the existing source record.",
  "addEvidence.url": "URL",
  "addEvidence.outcome": "Outcome",
  "addEvidence.chooseAnOutcome": "Choose an outcome",
  "addEvidence.summary": "What does it show about the claim?",
  "addEvidence.limitations": "What does it NOT establish?",
  "addEvidence.limitationsHint": "Scope, sample, conditions, open questions. Strongly encouraged.",
  "addEvidence.locator": "Where in the source",
  "addEvidence.locatorHint": "Page, figure, table, section…",
  "addEvidence.forClaim": "For the claim: “{claim}”",

  // Standalone claim page. The statedByPerson placeholder links to a contributor.
  "claimPage.claim": "Claim",
  "claimPage.argue": "Argue",
  "claimPage.forAndAgainst": "For and against",
  "claimPage.noEvidenceHelp": "Until evidence is attached, this claim remains a hypothesis.",
  "claimPage.reasoning": "Reasoning",
  "claimPage.sharedKnowledge": "Shared knowledge",
  "claimPage.ideasRestingOnIt": "Ideas resting on it",
  "claimPage.underpinsCount": "{count, plural, one {Underpins # idea} other {Underpins # ideas}}",
  "claimPage.title": "Claim: {claim}",
  "claimPage.statedByPerson": "Stated by <0/>",
  "claimPage.evidence": "Evidence",
  "claimPage.arguments": "Arguments",

  // Shared title, counter and heading patterns.
  "common.pageTitle": "{title} · ideaproxima",
  "common.countLabel": "{label} ({count, number})",
  "common.counter": "{count, number} / {total, number}",

  // Idea editor and revision pages. The conflict placeholders hold the highlighted warning and a link to history.
  "editor.edit.edit": "Edit",
  "editor.edit.suggestAnEdit": "Suggest an edit",
  "editor.edit.publishLede":
    "As a steward you publish directly. A new revision is created; the previous one stays in the history.",
  "editor.edit.proposalLede":
    "Your changes become a proposed revision. The idea's stewards will accept or decline it, and you are credited either way.",
  "editor.edit.rebase": "Use the latest revision as the base",
  "editor.edit.publishRevision": "Publish revision",
  "editor.edit.proposeRevision": "Propose revision",
  "editor.edit.changeNote": "What changed and why",
  "editor.edit.changeNoteHint": "Shown in the history.",
  "editor.aTitle": "A title",
  "editor.aShortSummary": "A short summary",
  "editor.atLeastOneTopic": "At least one topic",
  "editor.thePossibility": "The possibility",
  "editor.titleLabel": "What possibility do you want humanity to remember?",
  "editor.nameTheIdea": "Name the idea",
  "editor.summaryLabel": "In two or three sentences",
  "editor.summaryHint": "What is it, and why might it matter? This is what people see in lists.",
  "editor.whereItBelongs": "Where it belongs",
  "editor.primaryTopic": "Primary topic",
  "editor.primary": "(primary)",
  "editor.tags": "Tags",
  "editor.tagsHint": "optional · press Enter to add",
  "editor.tagsExample": "e.g. water, microplastics",
  "editor.developIt": "Develop it",
  "editor.sectionsHint": "every part is optional; speculation is allowed",
  "editor.written": "Written",
  "editor.write": "Write",
  "editor.overviewPlaceholder": "What exactly is proposed, in more detail?",
  "editor.markdownHint": "Sections support Markdown: **bold**, *italic*, lists, [links](https://…).",
  "editor.previewHeading": "How it will appear",
  "editor.previewLabel": "Preview of the idea in lists",
  "editor.yourTitle": "Your title",
  "editor.previewSummary": "Your summary will appear here.",
  "editor.new.proposeAPossibility": "Propose a possibility",
  "editor.new.title": "Write it down before it is lost",
  "editor.new.lede":
    "An idea does not need to be feasible, proven or popular to deserve preservation. Start with a title and a summary; anyone can help develop the rest.",
  "editor.new.addToTheArchive": "Add to the archive",
  "editor.new.draftHelp":
    "You become the idea's first steward. Your draft is kept in this browser until you publish.",
  "editor.edit.title": "Edit: {idea}",
  "editor.edit.conflict":
    "<0>Someone published a newer revision while you were editing.</0> Your text is kept below. Review the <1>latest changes</1>, then submit again on top of them.",
  "editor.edit.baseRevision": "Editing revision {number, number}.",
  "editor.topicSelection": "Topics <0>{min, number}–{max, number}; the first is primary</0>",
  "editor.removeTag": "Remove tag {tag}",
  "editor.requirement.aTitle": "Add a title to publish.",
  "editor.requirement.aShortSummary": "Add a short summary to publish.",
  "editor.requirement.atLeastOneTopic": "Add at least one topic to publish.",
  "editor.requirementStatus": " — {done, select, yes {done} other {missing}}",
  "editor.sectionProgress": "Sections developed: <0>{count, number}</0> of {total, number} <1>(optional)</1>",

  // Client error feedback. The API supplies the detail. Request IDs, HTTP statuses and field identifiers are diagnostic data.
  "error.route.eyebrow": "Something went wrong",
  "error.route.title": "This page could not be loaded.",
  "error.route.goHome": "Go home",
  "error.requestId": "{detail} Quote this id if you report the problem: {requestId}",
  "error.signIn": "Please sign in to do that.",
  "error.fieldIssue": "{field} — {detail}",
  "error.validation": "Please check: {issues}",
  "error.request": "request",
  "error.httpStatus": "The server returned HTTP {status, number}.",

  // Evaluation dialog. The subject is a title or a translated label, and the dimension is a vocabulary label.
  "evaluate.description": "Rate only what you can judge — every dimension is optional and stays separate.",
  "evaluate.iDonTKnow": "I don't know",
  "evaluate.howSureAreYou": "How sure are you?",
  "evaluate.unsure": "Unsure",
  "evaluate.why": "Why?",
  "evaluate.rationaleHint":
    "What your ratings rest on — a source, an experience, a calculation. Shown with them.",
  "evaluate.withdrawMine": "Withdraw mine",
  "evaluate.updateEvaluation": "Update evaluation",
  "evaluate.saveEvaluation": "Save evaluation",
  "evaluate.title": "Evaluate “{subject}”",
  "evaluate.confidenceLabel": "Confidence in your {dimension} rating",
  "evaluate.progress":
    "<0>{count, number} of {total, number}</0> rated{remaining, select, yes { · the rest stay “I don't know”} other {}}",
  "evaluate.confidence.low": "Low",
  "evaluate.confidence.medium": "Medium",
  "evaluate.confidence.high": "High",

  // Loading and retry states and the default disclosure label.
  "feedback.tryAgain": "Try again",
  "feedback.loading": "Loading…",
  "feedback.howComputed": "How is this computed?",

  // Optional form-field hint.
  "field.optional": "optional",

  // Involvement dialog. The capacity is a vocabulary label.
  "involve.howCanYouHelp": "How can you help?",
  "involve.description":
    "Your involvement is shown on the idea, so others looking to collaborate can find you.",
  "involve.inWhatCapacity": "In what capacity?",
  "involve.whereDoYouStand": "Where do you stand?",
  "involve.noteHint": "What you can offer, or what you are working on.",
  "involve.update": "Update",
  "involve.recordMyInvolvement": "Record my involvement",
  "involve.withdraw": "Remove my {capacity} involvement",

  // Moderation dialog. The action and target are stable keys. Translate each complete title.
  "moderation.restore": "Restore",
  "moderation.hide": "Hide",
  "moderation.restoreHelp": "It becomes publicly visible again.",
  "moderation.hideHelp":
    "It disappears from public views but stays in the record. The reason is published in the moderation log.",
  "moderation.actionTitle":
    "{restore, select, yes {{kind, select, idea {Restore this idea} revision {Restore this revision} claim {Restore this claim} evidence {Restore this evidence} argument {Restore this argument} comment {Restore this comment} relation {Restore this relation} initiative {Restore this initiative} outcome {Restore this outcome} source {Restore this source} other {Restore this content}}} other {{kind, select, idea {Hide this idea} revision {Hide this revision} claim {Hide this claim} evidence {Hide this evidence} argument {Hide this argument} comment {Hide this comment} relation {Hide this relation} initiative {Hide this initiative} outcome {Hide this outcome} source {Hide this source} other {Hide this content}}}}",

  // Missing or hidden page and its recovery controls.
  "notFound.heading": "Nothing is archived here.",
  "notFound.description":
    "The page may have moved, or the content was hidden by moderation. Hidden content stays in the record; the public moderation log explains why.",
  "notFound.searchLabel": "Search for what you were looking for",
  "notFound.title": "Not found",

  // Public profile and moderation controls. Contribution plurals describe the number shown beside each label.
  "person.ideas": "Ideas",
  "person.helpingWith": "Helping with",
  "person.editProfile": "Edit profile",
  "person.deactivated": "Deactivated",
  "person.canHelpWith": "Can help with",
  "person.expertise": "Expertise",
  "person.verified": "verified",
  "person.selfDeclared": "self-declared",
  "person.recordedContributions": "Recorded contributions",
  "person.noContributionsRecordedYet": "No contributions recorded yet.",
  "person.contributionsDescription":
    "Plain counts of what is in the record — not a measure of quality, influence or intelligence.",
  "person.aboutTheseNumbers": "About these numbers",
  "person.contributionsHelp":
    "Contribution influence (how strongly someone's evaluations count, per domain) will be computed from demonstrated judgment, and explained here when it exists.",
  "person.profileSections": "Profile sections",
  "person.noIdeasProposedYet": "No ideas proposed yet",
  "person.anIdeaDoesNot": "An idea does not need to be feasible, proven or popular to be kept.",
  "person.notInvolvedInAny": "Not involved in any idea yet",
  "person.olderActivity": "Older activity",
  "person.role": "Role",
  "person.deactivateAccount": "Deactivate account",
  "person.reactivateAccount": "Reactivate account",
  "person.deactivateThisAccount": "Deactivate this account",
  "person.reactivateThisAccount": "Reactivate this account",
  "person.deactivateHelp":
    "They will be signed out and unable to act. Their contributions stay, attributed. The reason is published.",
  "person.reactivateHelp": "They will be able to sign in and contribute again.",
  "person.deactivate": "Deactivate",
  "person.reactivate": "Reactivate",
  "person.role.member": "member",
  "person.roleOption.member": "Member",
  "person.role.moderator": "moderator",
  "person.roleOption.moderator": "Moderator",
  "person.role.admin": "admin",
  "person.roleOption.admin": "Admin",
  "person.contributions.ideasProposed": "{count, plural, one {idea proposed} other {ideas proposed}}",
  "person.contributions.revisionsAccepted":
    "{count, plural, one {revision accepted} other {revisions accepted}}",
  "person.contributions.claims": "{count, plural, one {claim stated} other {claims stated}}",
  "person.contributions.evidence": "{count, plural, one {piece of evidence} other {pieces of evidence}}",
  "person.contributions.arguments": "{count, plural, one {argument} other {arguments}}",
  "person.contributions.evaluations": "{count, plural, one {evaluation} other {evaluations}}",
  "person.contributions.comments": "{count, plural, one {comment} other {comments}}",
  "person.contributions.initiatives":
    "{count, plural, one {initiative recorded} other {initiatives recorded}}",
  "person.contributions.usefulReceived":
    "{count, plural, one {time marked useful} other {times marked useful}}",
  "person.joinedOn": " · joined {date}",
  "person.sinceDate": "· since <0/>",

  // Shared confirmation form that records a public reason.
  "reason.reason": "Reason",
  "reason.publicHint": "Recorded publicly with this action.",

  // Search screens. The query is user text. Preserve the search operators in the examples.
  "search.placeholder": "Ideas, claims, sources, people…",
  "search.clearTheSearch": "Clear the search",
  "search.resultTypes": "Result types",
  "search.emptyHelp":
    "Try fewer or different words. If the idea is not here yet, it may be yours to propose.",
  "search.ideas": "Ideas",
  "search.claims": "Claims",
  "search.sources": "Sources",
  "search.people": "People",
  "search.noMatchingIdeas": "No matching ideas",
  "search.proposeHelp":
    "If you have one in mind, write it down — it does not need to be feasible or proven to be kept.",
  "search.intro":
    "Search titles, summaries, claim statements, source titles and names. Or start from a domain:",
  "search.exploreAllIdeas": "Explore all ideas",
  "search.allTypes": "All",
  "search.queryTitle": "“{query}” · Search",
  "search.empty": "Nothing found for “{query}”",
  "search.noMatchingIdea": "No idea mentions “{query}” yet.",
  "search.browseTopic": "Browse the <0/> topic, or write the idea down yourself.",
  "search.examples": 'Tips: <0>"exact phrase"</0> · <1>water OR soil</1> · <2>nanorobots -medical</2>',

  // Standalone source page. The registeredByPerson placeholder links to a contributor.
  "sourcePage.source": "Source",
  "sourcePage.deduplicationHelp":
    "Sources are deduplicated by DOI and URL, so every claim citing this work points to the same record.",
  "sourcePage.citationCount":
    "{count, plural, one {Cited as evidence # time} other {Cited as evidence # times}}",
  "sourcePage.registeredByPerson": "Registered by <0/>",
  "sourcePage.authors": "Authors",
  "sourcePage.venue": "Venue",
  "sourcePage.year": "Year",

  // Stage transition dialog. The stage and proof requirement come from the domain.
  "stageDialog.recordAStageChange": "Record a stage change",
  "stageDialog.description":
    "Stage changes are permanent entries in the idea's history, with your rationale.",
  "stageDialog.newStage": "New stage",
  "stageDialog.requirementMet": "✓ Requirement met",
  "stageDialog.rationale": "Rationale",
  "stageDialog.rationaleHint": "Why the idea is now at this stage. Shown in the idea's history.",
  "stageDialog.motivatingInitiative": "Motivating initiative",
  "stageDialog.initiativeHint": "The experiment, pilot or deployment that justifies the change.",
  "stageDialog.none": "None",
  "stageDialog.recordStage": "Record stage",
  "stageDialog.currentStage": "Currently: {stage}.",
  "stageDialog.needsProof": "Needs: {requirement}", // The stage's proof requirement, from the domain catalogue.

  // Success notifications and their dismiss button. Revision numbers identify published revisions.
  "toast.topicCreated": "Topic created.",
  "toast.connectionRecorded": "Connection recorded.",
  "toast.connectionRetracted": "Connection retracted.",
  "toast.ideaProposed": "Your idea is in the archive.",
  "toast.proposalWithdrawn": "Proposal withdrawn.",
  "toast.stageRecorded": "Stage recorded.",
  "toast.stewardAppointed": "Steward appointed.",
  "toast.claimAdded": "Claim added.",
  "toast.claimUnlinked": "Claim unlinked from this idea.",
  "toast.evidenceAttached": "Evidence attached.",
  "toast.evidenceWithdrawn": "Evidence withdrawn. It stays in the record, marked as withdrawn.",
  "toast.argumentAdded": "Argument added.",
  "toast.argumentWithdrawn": "Argument withdrawn.",
  "toast.profileSaved": "Profile saved.",
  "toast.passwordChanged": "Password changed. Your other sessions were signed out.",
  "toast.expertiseDeclared": "Expertise declared.",
  "toast.roleChanged": "Role changed. The change is recorded in the public activity log.",
  "toast.initiativeRecorded": "Initiative recorded.",
  "toast.statusUpdated": "Status updated.",
  "toast.outcomeRecorded": "Outcome recorded. Failures are knowledge too.",
  "toast.ratingsWithdrawn": "Your ratings were withdrawn. They remain in the history as superseded.",
  "toast.involvementRecorded": "Thank you. Your involvement is recorded on the idea.",
  "toast.revisionProposed": "Your proposed revision is waiting for a steward's decision.",
  "toast.dismiss": "Dismiss",
  "toast.revisionPublished": "Revision {number, number} published.",

  // Individual topic page. Topic names come from the locale-specific API catalogue.
  "topic.breadcrumb": "Breadcrumb",
  "topic.proposeAnIdeaHere": "Propose an idea here",
  "topic.order": "Order",
  "topic.lensEmpty": "No ideas under this lens yet",
  "topic.proposeTheFirst": "Propose the first",
  "topic.lensEmptyHelp": "Assessment-based lenses only include ideas with enough independent ratings.",
  "topic.emptyHelp": "An idea does not need to be feasible, proven or popular to deserve preservation.",
  "topic.oftenTogetherWith": "Often together with",
  "topic.ideasIn": "Ideas in {topic}",
  "topic.empty": "No ideas in {topic} yet",
  "topic.sharedCount": "{count, number} shared",

  // Topic directory and creation dialog.
  "topics.lede": "Ideas span domains: each belongs to up to four topics, the first being its primary home.",
  "topics.newTopic": "New topic",
  "topics.noIdeasYet": "No ideas yet.",
  "topics.proposeTheFirst": "Propose the first",
  "topics.newest": "Newest",
  "topics.createDescription": "Topic changes are recorded in the public activity log.",
  "topics.description": "Description",
  "topics.nestUnder": "Nest under",
  "topics.topLevel": "Top level",
  "topics.createTopic": "Create topic",
} as const;

export type MessageId = keyof typeof englishMessages;

// Small beta fixtures for the web localization audit. Full translated catalogues are phase D.
export const translatedMessages = {
  ar: {
    "account.account": "الحساب",
    "nav.account": "حسابك",
    "account.profile": "الملف الشخصي",
    "account.saveProfile": "احفظ الملف الشخصي",
    "activity.idea.proposed": "اقترح <0/>",
    "activityPage.filterTheRecord": "تصفية السجل",
    "addClaim.title": "أضف ادعاءً",
    "about.title": "ذاكرة جماعية لمحاولات البشرية تخيل مستقبلها",
    "claimPage.claim": "ادعاء",
    "editor.nameTheIdea": "سم الفكرة",
    "editor.new.title": "دوّنها قبل أن تضيع",
    "error.signIn": "سجّل الدخول للقيام بذلك.",
    "error.requestId": "{detail} اذكر هذا المعرّف عند الإبلاغ عن المشكلة: {requestId}",
    "evaluate.title": "قيّم «{subject}»",
    "feedback.tryAgain": "حاول مجددًا",
    "notFound.heading": "لا يوجد شيء في الأرشيف هنا.",
    "person.recordedContributions": "المساهمات المسجلة",
    "search.empty": "لا نتائج عن «{query}»",
    "sourcePage.source": "مصدر",
    "toast.dismiss": "إخفاء الإشعار",
    "toast.profileSaved": "حُفظ الملف الشخصي.",
    "topic.proposeAnIdeaHere": "اقترح فكرة هنا",
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
    "error.retryAfter": "طلبات كثيرة جدًا. يُرجى الانتظار لمدة {seconds} ثانية قبل المحاولة مجددًا.",
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
