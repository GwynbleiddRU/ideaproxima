// The full relational model. See docs/agents/data-model.md for the reasoning behind each table.
//
//   identity        people, accounts, sessions, topics, person_expertise
//   ideas           ideas (identity + projections), idea_revisions, idea_topics, idea_stewards, stage_transitions
//   knowledge       claims, idea_claims, sources, evidence, arguments
//   signals         evaluations, stances, involvements
//   graph           idea_relations
//   practice        initiatives, outcomes
//   discussion      comments
//   history         activities (append-only ledger)
//   derived         idea_metrics (disposable, rebuildable)
export * from "./people";
export * from "./ideas";
export * from "./knowledge";
export * from "./signals";
export * from "./graph";
export * from "./practice";
export * from "./discussion";
export * from "./ledger";
export * from "./derived";
