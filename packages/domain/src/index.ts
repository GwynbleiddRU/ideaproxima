// @ideaproxima/domain — the product's shared language and rules. Pure TypeScript, no I/O, safe to import from
// the API, scripts and the frontend alike.

export * from "./vocabulary/term";
export * from "./vocabulary/index";

export * from "./errors";
export * from "./errors.en";
export * from "./product-vocabulary";

export * from "./rules/content";
export * from "./rules/lifecycle";
export * from "./rules/relations";
export * from "./rules/signals";
export * from "./rules/permissions";
export * from "./rules/rate-limits";

export * from "./metrics/baseline";
