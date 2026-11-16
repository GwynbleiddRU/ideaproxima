import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useRef } from "react";
import {
  FileText,
  Flag,
  Gauge,
  GitFork,
  Lightbulb,
  List,
  Paperclip,
  PenLine,
  Rocket,
  Scale,
  Shield,
  Target,
  type LucideIcon,
} from "lucide-react";
import { catalogQueries } from "@/api/catalog";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PageHeader } from "@/components/PageHeader";
import { cx } from "@/lib/cx";
import { useRevealOnChange } from "@/lib/hooks";
import { Button } from "@/ui/Button";
import { control } from "@/ui/Field";
import { EmptyState, ErrorState, Skeleton } from "@/ui/Feedback";
import styles from "./ActivityPage.module.scss";

interface Filter {
  action?: string;
  label: string;
  icon: LucideIcon;
}

/** Verb families of the ledger, grouped; each is an action prefix the API filters on. */
const GROUPS: { label?: string; filters: Filter[] }[] = [
  { filters: [{ label: "Everything", icon: List }] },
  {
    label: "Ideas",
    filters: [
      { action: "idea.", label: "New ideas", icon: Lightbulb },
      { action: "revision.", label: "Revisions", icon: PenLine },
      { action: "stage.", label: "Stage changes", icon: Flag },
    ],
  },
  {
    label: "Knowledge",
    filters: [
      { action: "claim.", label: "Claims", icon: FileText },
      { action: "evidence.", label: "Evidence", icon: Paperclip },
      { action: "argument.", label: "Arguments", icon: Scale },
      { action: "relation.", label: "Connections", icon: GitFork },
    ],
  },
  { label: "Judgement", filters: [{ action: "evaluation.", label: "Evaluations", icon: Gauge }] },
  {
    label: "Practice",
    filters: [
      { action: "initiative.", label: "Initiatives", icon: Rocket },
      { action: "outcome.", label: "Outcomes", icon: Target },
    ],
  },
  { label: "Transparency", filters: [{ action: "moderation.", label: "Moderation log", icon: Shield }] },
];
const ALL = GROUPS.flatMap((g) => g.filters);

/** The append-only activity ledger: everything that happened, newest first. Moderation is public too. */
export function ActivityPage() {
  const { action } = useSearch({ from: "/activity" });
  const navigate = useNavigate({ from: "/activity" });
  const feed = useInfiniteQuery(catalogQueries.activity(action));
  const entries = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const moderation = action === "moderation.";
  const feedRef = useRef<HTMLElement>(null);
  // Filtering replaces the feed in place: no jump to the page top; show the new feed from its first entry.
  useRevealOnChange(feedRef, action);

  return (
    <div className="container">
      <title>{moderation ? "Moderation log · ideaproxima" : "Activity · ideaproxima"}</title>
      <PageHeader
        title={moderation ? "Moderation log" : "Activity"}
        lede={
          moderation
            ? "Every hide, restore, deactivation and reactivation, with the moderator and the reason. Hidden content is never deleted."
            : "Every contribution is recorded and nothing is rewritten — the archive's memory of how ideas progress."
        }
      />
      <div className={styles.layout}>
        <nav className={styles.rail} aria-label="Filter the record">
          {GROUPS.map((group, i) => (
            <div key={group.label ?? i} className={styles.group}>
              {group.label && <p className={styles.groupLabel}>{group.label}</p>}
              {group.filters.map(({ action: a, label, icon: Icon }) => (
                <Link
                  key={label}
                  to="/activity"
                  search={{ action: a }}
                  resetScroll={false}
                  className={cx(styles.filter, a === action && styles.filterActive)}
                  aria-current={a === action ? "page" : undefined}
                >
                  <Icon aria-hidden /> {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <label className={styles.select}>
          <span className="visually-hidden">Show</span>
          <select
            className={control}
            value={action ?? ""}
            onChange={(e) =>
              void navigate({ search: { action: e.target.value || undefined }, resetScroll: false })
            }
          >
            {ALL.map((f) => (
              <option key={f.label} value={f.action ?? ""}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <section ref={feedRef} className={styles.feed} aria-label="The record">
          {feed.isPending ? (
            <Skeleton lines={10} />
          ) : feed.isError ? (
            <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
          ) : entries.length ? (
            <ActivityFeed entries={entries} byDay dayHeading="h2" />
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
        </section>
      </div>
    </div>
  );
}
