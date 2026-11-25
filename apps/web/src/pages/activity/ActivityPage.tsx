import type { MessageId } from "@/locales/messages";
import { useMessage } from "@/locales/react";
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
  label: MessageId;
  icon: LucideIcon;
}

/** Verb families of the ledger, grouped; each is an action prefix the API filters on. */
const GROUPS: { label?: MessageId; filters: Filter[] }[] = [
  { filters: [{ label: "activityPage.filter.everything", icon: List }] },
  {
    label: "activityPage.filter.ideas",
    filters: [
      { action: "idea.", label: "activityPage.filter.newIdeas", icon: Lightbulb },
      { action: "revision.", label: "activityPage.filter.revisions", icon: PenLine },
      { action: "stage.", label: "activityPage.filter.stageChanges", icon: Flag },
    ],
  },
  {
    label: "activityPage.filter.knowledge",
    filters: [
      { action: "claim.", label: "activityPage.filter.claims", icon: FileText },
      { action: "evidence.", label: "activityPage.filter.evidence", icon: Paperclip },
      { action: "argument.", label: "activityPage.filter.arguments", icon: Scale },
      { action: "relation.", label: "activityPage.filter.connections", icon: GitFork },
    ],
  },
  {
    label: "activityPage.filter.judgement",
    filters: [{ action: "evaluation.", label: "activityPage.filter.evaluations", icon: Gauge }],
  },
  {
    label: "activityPage.filter.practice",
    filters: [
      { action: "initiative.", label: "activityPage.filter.initiatives", icon: Rocket },
      { action: "outcome.", label: "activityPage.filter.outcomes", icon: Target },
    ],
  },
  {
    label: "activityPage.filter.transparency",
    filters: [{ action: "moderation.", label: "activityPage.filter.moderationLog", icon: Shield }],
  },
];
const ALL = GROUPS.flatMap((g) => g.filters);

/** The append-only activity ledger: everything that happened, newest first. Moderation is public too. */
export function ActivityPage() {
  const t = useMessage();
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
      <title>{t("common.pageTitle", { title: t(moderation ? "nav.moderation" : "nav.activity") })}</title>
      <PageHeader
        title={moderation ? t("nav.moderation") : t("nav.activity")}
        lede={moderation ? t("activityPage.moderationLede") : t("activityPage.activityLede")}
      />
      <div className={styles.layout}>
        <nav className={styles.rail} aria-label={t("activityPage.filterTheRecord")}>
          {GROUPS.map((group, i) => (
            <div key={group.label ?? i} className={styles.group}>
              {group.label && <p className={styles.groupLabel}>{t(group.label)}</p>}
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
          <span className="visually-hidden">{t("activityPage.show")}</span>
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

        <section ref={feedRef} className={styles.feed} aria-label={t("activityPage.theRecord")}>
          {feed.isPending ? (
            <Skeleton lines={10} />
          ) : feed.isError ? (
            <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
          ) : entries.length ? (
            <ActivityFeed entries={entries} byDay dayHeading="h2" />
          ) : (
            <EmptyState
              title={moderation ? t("activityPage.moderationEmpty") : t("activityPage.activityEmpty")}
            />
          )}
          {feed.hasNextPage && (
            <div className={styles.more}>
              <Button onClick={() => void feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
                {t("activityPage.olderEntries")}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
