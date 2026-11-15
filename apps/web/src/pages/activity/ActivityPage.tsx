import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { catalogQueries } from "@/api/catalog";
import { ActivityItem, ActivityList } from "@/components/ActivityItem";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/ui/Button";
import { ChipLink } from "@/ui/Chip";
import { EmptyState, ErrorState, Skeleton } from "@/ui/Feedback";
import styles from "./ActivityPage.module.scss";

/** Verb families of the ledger; each is an action prefix the API filters on. */
const FILTERS: { action?: string; label: string }[] = [
  { label: "Everything" },
  { action: "idea.", label: "New ideas" },
  { action: "revision.", label: "Revisions" },
  { action: "stage.", label: "Stage changes" },
  { action: "claim.", label: "Claims" },
  { action: "evidence.", label: "Evidence" },
  { action: "argument.", label: "Arguments" },
  { action: "evaluation.", label: "Evaluations" },
  { action: "initiative.", label: "Initiatives" },
  { action: "outcome.", label: "Outcomes" },
  { action: "relation.", label: "Connections" },
  { action: "moderation.", label: "Moderation log" },
];

/** The append-only activity ledger: everything that happened, newest first. Moderation is public too. */
export function ActivityPage() {
  const { action } = useSearch({ from: "/activity" });
  const feed = useInfiniteQuery(catalogQueries.activity(action));
  const entries = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const moderation = action === "moderation.";

  return (
    <div className="container">
      <title>{moderation ? "Moderation log · ideaproxima" : "Activity · ideaproxima"}</title>
      <PageHeader
        eyebrow={moderation ? "Transparency" : "The living record"}
        title={moderation ? "Moderation log" : "Activity"}
        lede={
          moderation
            ? "Every hide, restore, deactivation and reactivation, with the moderator and the reason. Hidden content is never deleted."
            : "Every contribution is recorded and nothing is rewritten. This is the archive's memory of how ideas progress."
        }
      />
      <nav className={styles.filters} aria-label="Filter activity">
        {FILTERS.map((f) => (
          <ChipLink
            key={f.label}
            to="/activity"
            search={{ action: f.action }}
            activeOptions={{ includeSearch: true }}
          >
            {f.label}
          </ChipLink>
        ))}
      </nav>
      <div className={styles.feed}>
        {feed.isPending ? (
          <Skeleton lines={10} />
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
        ) : entries.length ? (
          <ActivityList>
            {entries.map((e) => (
              <ActivityItem key={e.id} entry={e} />
            ))}
          </ActivityList>
        ) : (
          <EmptyState title={moderation ? "No moderation actions yet" : "Nothing recorded yet"} />
        )}
        {feed.hasNextPage && (
          <div className={styles.more}>
            <Button onClick={() => void feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
              Older entries
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
