import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

export const METRICS_PATH = "/metrics";
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Completed public HTTP requests.",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});
export const httpDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Time to produce a public HTTP response.",
  labelNames: ["method", "route", "status_class"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});
export const httpInFlight = new Gauge({
  name: "http_requests_in_flight",
  help: "Public HTTP requests currently being handled.",
  registers: [registry],
});
export const dbErrors = new Counter({
  name: "db_errors_total",
  help: "Database errors observed at the HTTP boundary by SQLSTATE class.",
  labelNames: ["code"] as const,
  registers: [registry],
});
export const rateLimitDecisions = new Counter({
  name: "rate_limit_decisions_total",
  help: "Decisions for enabled rate-limit policies.",
  labelNames: ["policy", "outcome"] as const,
  registers: [registry],
});
export const passwordHashQueueDepth = new Gauge({
  name: "password_hash_queue_depth",
  help: "Password operations waiting for a hashing slot.",
  registers: [registry],
});
