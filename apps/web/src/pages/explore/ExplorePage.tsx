import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Compass, Search, SlidersHorizontal, X } from "lucide-react";
import { IDEA_STAGE_INFO, IDEA_STAGES, LENS_INFO, type IdeaStage } from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { ideaQueries } from "@/api/ideas";
import type { ExploreSearch } from "@/app/search-params";
import { IdeaCard } from "@/components/IdeaCard";
import { PageHeader } from "@/components/PageHeader";
import { cx } from "@/lib/cx";
import { plural } from "@/lib/format";
import { useRevealOnChange } from "@/lib/hooks";
import {
  DEFAULT_CARD_DIMENSIONS,
  LENS_DIMENSIONS,
  LENS_GROUPS,
  MIN_RATINGS_FOR_CONFIDENCE,
  SIGNAL_INFO,
} from "@/lib/vocabulary";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { ChipLink } from "@/ui/Chip";
import { Dialog } from "@/ui/Dialog";
import { control } from "@/ui/Field";
import { EmptyState, ErrorState, Skeleton } from "@/ui/Feedback";
import styles from "./ExplorePage.module.scss";

type Patch = (patch: Partial<ExploreSearch>, replace?: boolean) => void;

export function ExplorePage() {
  const search = useSearch({ from: "/explore" });
  const navigate = useNavigate({ from: "/explore" });
  const lens = search.lens ?? "newest";
  const info = LENS_INFO[lens];
  const [sheet, setSheet] = useState(false);
  const results = useRef<HTMLElement>(null);
  // Filters and lenses change the list in place: never jump to the top of the page (the router's default);
  // after a lens switch from the sticky rail, show the new list from its first item.
  useRevealOnChange(results, lens);
  const setSearch: Patch = (patch, replace = false) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace, resetScroll: false });
  const query = useInfiniteQuery(
    ideaQueries.list({
      lens,
      topic: search.topic,
      stage: search.stage,
      tag: search.tag,
      q: search.q,
      limit: 15,
    }),
  );
  const ideas = query.data?.pages.flatMap((p) => p.items) ?? [];
  const activeCount = [search.topic, search.stage, search.tag, search.q].filter(Boolean).length;
  const count = query.isSuccess
    ? query.hasNextPage
      ? `${ideas.length}+ ideas`
      : plural(ideas.length, "idea")
    : null;

  return (
    <div className="container">
      <title>{`${info.label} · Explore · ideaproxima`}</title>
      <PageHeader
        title="Explore ideas"
        lede="Choose a lens — each one ranks on a single, named signal and says so. Narrow it with a topic or a stage."
      />
      <div className={styles.layout}>
        <nav className={styles.rail} aria-label="Lenses">
          {LENS_GROUPS.map((group) => (
            <div key={group.signal} className={styles.lensGroup}>
              <p className={styles.groupLabel} title={SIGNAL_INFO[group.signal].description}>
                {SIGNAL_INFO[group.signal].label}
              </p>
              {group.lenses.map((key) => (
                <Link
                  key={key}
                  to="/explore"
                  search={(prev) => ({ ...prev, lens: key === "newest" ? undefined : key })}
                  resetScroll={false}
                  className={cx(styles.lensLink, key === lens && styles.lensActive)}
                  aria-current={key === lens ? "page" : undefined}
                >
                  {LENS_INFO[key].label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <section ref={results} className={styles.results} aria-label="Results">
          {/* Phones and tablets: lenses as a scrolling row, filters in a sheet. */}
          <div className={styles.compactBar}>
            <div className={styles.lensChips} role="list" aria-label="Lenses">
              {LENS_GROUPS.flatMap((g) => g.lenses).map((key) => (
                <span role="listitem" key={key}>
                  <ChipLink
                    to="/explore"
                    search={(prev) => ({ ...prev, lens: key === "newest" ? undefined : key })}
                    resetScroll={false}
                    aria-current={key === lens ? "page" : undefined}
                  >
                    {LENS_INFO[key].label}
                  </ChipLink>
                </span>
              ))}
            </div>
            <div className={styles.compactActions}>
              <Button size="sm" icon={<SlidersHorizontal />} onClick={() => setSheet(true)}>
                Filters
                {activeCount > 0 && <span className={styles.filterCount}>{activeCount}</span>}
              </Button>
              {count && <span className={styles.count}>{count}</span>}
            </div>
          </div>

          <div className={styles.toolbar}>
            <Filters search={search} onChange={setSearch} />
          </div>

          <div className={styles.lensLine} aria-live="polite">
            <Badge
              tone={
                info.signal === "attention" ? "warning" : info.signal === "quality" ? "primary" : "neutral"
              }
            >
              {SIGNAL_INFO[info.signal].label}
            </Badge>
            <span>
              <b>{info.label}</b> — {info.description}
            </span>
            <ActiveFilters search={search} onChange={setSearch} />
            {count && <span className={cx(styles.count, styles.countWide)}>{count}</span>}
          </div>

          {query.isPending ? (
            <Skeleton lines={10} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : !ideas.length ? (
            <EmptyState
              icon={<Compass />}
              title="No ideas match"
              action={
                <ButtonLink to="/explore" variant="secondary">
                  Clear filters
                </ButtonLink>
              }
            >
              Lenses based on assessments only include ideas with enough independent ratings. Try another
              lens, or help by evaluating ideas under “Needs review”.
            </EmptyState>
          ) : (
            <>
              <ol className={styles.list} role="list">
                {ideas.map((idea) => (
                  <li key={idea.id}>
                    <IdeaCard
                      idea={idea}
                      layout="row"
                      dimensions={LENS_DIMENSIONS[lens] ?? DEFAULT_CARD_DIMENSIONS}
                    />
                  </li>
                ))}
              </ol>
              {query.hasNextPage && (
                <div className={styles.more}>
                  <Button onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
                    Show more
                  </Button>
                </div>
              )}
              <p className={styles.legend}>
                Measures show the scale anchor nearest the mean, the mean and n (how many evaluators); the
                whisker is their spread. Under {MIN_RATINGS_FOR_CONFIDENCE} evaluations a measure reads “too
                early” (●○○).
              </p>
            </>
          )}
        </section>
      </div>

      <Dialog
        open={sheet}
        onClose={() => setSheet(false)}
        size="sm"
        title="Filters"
        footer={
          <Button variant="primary" onClick={() => setSheet(false)}>
            {count ? `Show ${count}` : "Show results"}
          </Button>
        }
      >
        <Filters search={search} onChange={setSearch} stacked />
      </Dialog>
    </div>
  );
}

function Filters({
  search,
  onChange,
  stacked,
}: {
  search: ExploreSearch;
  onChange: Patch;
  stacked?: boolean;
}) {
  const topics = useQuery(catalogQueries.topics());
  const [q, setQ] = useState(search.q ?? "");
  const [urlQ, setUrlQ] = useState(search.q);
  // The URL changed from elsewhere (e.g. the filter chip was removed): adopt it.
  if (search.q !== urlQ) {
    setUrlQ(search.q);
    setQ(search.q ?? "");
  }

  // Type freely; the URL (and the query) follow after a short pause.
  useEffect(() => {
    const next = q.trim() || undefined;
    if (next === search.q) return;
    const timer = setTimeout(() => onChange({ q: next }, true), 350);
    return () => clearTimeout(timer);
  }, [q, search.q, onChange]);

  return (
    <div className={cx(styles.filters, stacked && styles.stacked)}>
      <label className={styles.words}>
        <span className={stacked ? styles.filterLabel : "visually-hidden"}>Words</span>
        <Search aria-hidden className={styles.wordsIcon} />
        <input
          className={control}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by words in title or text"
        />
      </label>
      <label>
        <span className={stacked ? styles.filterLabel : "visually-hidden"}>Topic</span>
        <select
          className={control}
          value={search.topic ?? ""}
          onChange={(e) => onChange({ topic: e.target.value || undefined })}
        >
          <option value="">All topics</option>
          {topics.data?.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.parentId ? "  " : ""}
              {t.name} ({t.ideaCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={stacked ? styles.filterLabel : "visually-hidden"}>Stage</span>
        <select
          className={control}
          value={search.stage ?? ""}
          onChange={(e) => onChange({ stage: (e.target.value || undefined) as IdeaStage | undefined })}
        >
          <option value="">Any stage</option>
          {IDEA_STAGES.map((s) => (
            <option key={s} value={s}>
              {IDEA_STAGE_INFO[s].label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ActiveFilters({ search, onChange }: { search: ExploreSearch; onChange: Patch }) {
  const topics = useQuery(catalogQueries.topics());
  const topicName = topics.data?.find((t) => t.slug === search.topic)?.name ?? search.topic;
  const active = [
    search.topic && { key: "topic" as const, label: topicName },
    search.stage && { key: "stage" as const, label: IDEA_STAGE_INFO[search.stage].label },
    search.tag && { key: "tag" as const, label: `#${search.tag}` },
    search.q && { key: "q" as const, label: `“${search.q}”` },
  ].filter((f): f is { key: "topic" | "stage" | "tag" | "q"; label: string } => !!f);
  if (!active.length) return null;
  return (
    <span className={styles.active}>
      {active.map((f) => (
        <span key={f.key} className={styles.activeFilter}>
          {f.label}
          <button
            type="button"
            onClick={() => onChange({ [f.key]: undefined })}
            aria-label={`Remove ${f.label}`}
          >
            <X aria-hidden />
          </button>
        </span>
      ))}
    </span>
  );
}
