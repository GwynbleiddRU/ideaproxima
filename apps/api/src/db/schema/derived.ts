import { doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { tstz } from "./_columns";
import { ideas } from "./ideas";

/**
 * DERIVED — IDEA METRICS (materialised, disposable).
 *
 * Everything in this table is computed from facts elsewhere and can be deleted and rebuilt at any time
 * (`npm run metrics:rebuild`). It exists only so discovery lenses can sort and paginate efficiently.
 *
 * Key/value rather than wide columns so the future scoring system can add metrics (e.g. "evidence.graph_score",
 * "rating.impact.weighted") without migrations, and can run several algorithms side by side. Every row records
 * the algorithm that produced it. Nothing outside the metrics module may treat these values as ground truth.
 */
export const ideaMetrics = pgTable(
  "idea_metrics",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    metric: text("metric").notNull(),
    value: doublePrecision("value").notNull(),
    sampleSize: integer("sample_size").notNull().default(0),
    dispersion: doublePrecision("dispersion"),
    algorithm: text("algorithm").notNull(),
    computedAt: tstz("computed_at").notNull().defaultNow(),
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [
    primaryKey({ columns: [t.ideaId, t.metric] }),
    index("idea_metrics_metric_value_idx").on(t.metric, t.value),
  ],
);
