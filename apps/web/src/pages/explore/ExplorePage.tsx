import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Compass, Search, SlidersHorizontal, X } from "lucide-react";
import { IDEA_STAGE_INFO, IDEA_STAGES, LENS_INFO, type IdeaStage } from "@ideaproxima/domain";
import { useTopicNames, useTopicsQueryOptions } from "@/api/catalog";
import { ideaQueries } from "@/api/ideas";
import type { ExploreSearch } from "@/app/search-params";
import { IdeaCard } from "@/components/IdeaCard";
import { PageHeader } from "@/components/PageHeader";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/format";
import { formatCount } from "@/locales/runtime";
import { useRevealOnChange } from "@/lib/hooks";
import {
  DEFAULT_CARD_DIMENSIONS,
  LENS_DIMENSIONS,
  LENS_GROUPS,
  MIN_RATINGS_FOR_CONFIDENCE,
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
  const t = useMessage();
  const topicNames = useTopicNames();
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
      ? t("explore.atLeast", { count: ideas.length })
      : formatCount("count.idea", ideas.length)
    : null;

  return (
    <div className="container">
      <title>
        {t("explore.documentTitle", { lens: vocabularyField("lenses", lens, "label", info.label) })}
      </title>
      <PageHeader title={t("explore.title")} lede={t("explore.lede")} />
      <div className={styles.layout}>
        <nav className={styles.rail} aria-label={t("explore.lenses")}>
          {LENS_GROUPS.map((group) => (
            <div key={group.signal} className={styles.lensGroup}>
              <p className={styles.groupLabel} title={t(`lensSignal.${group.signal}.description`)}>
                {t(`lensSignal.${group.signal}.label`)}
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
                  {vocabularyField("lenses", key, "label", LENS_INFO[key].label)}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <section ref={results} className={styles.results} aria-label={t("explore.results")}>
          {/* Phones and tablets: lenses as a scrolling row, filters in a sheet. */}
          <div className={styles.compactBar}>
            <div className={styles.lensChips} role="list" aria-label={t("explore.lenses")}>
              {LENS_GROUPS.flatMap((g) => g.lenses).map((key) => (
                <span role="listitem" key={key}>
                  <ChipLink
                    to="/explore"
                    search={(prev) => ({ ...prev, lens: key === "newest" ? undefined : key })}
                    resetScroll={false}
                    aria-current={key === lens ? "page" : undefined}
                  >
                    {vocabularyField("lenses", key, "label", LENS_INFO[key].label)}
                  </ChipLink>
                </span>
              ))}
            </div>
            <div className={styles.compactActions}>
              <Button size="sm" icon={<SlidersHorizontal />} onClick={() => setSheet(true)}>
                {t("explore.filters")}
                {activeCount > 0 && <span className={styles.filterCount}>{formatNumber(activeCount)}</span>}
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
              {t(`lensSignal.${info.signal}.label`)}
            </Badge>
            <span>
              <LocalizedText
                id="explore.lensDescription"
                components={{ 0: <b /> }}
                values={{
                  lens: vocabularyField("lenses", lens, "label", info.label),
                  description: vocabularyField("lenses", lens, "description", info.description),
                }}
              />
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
              title={t("explore.emptyTitle")}
              action={
                <ButtonLink to="/explore" variant="secondary">
                  {t("explore.clear")}
                </ButtonLink>
              }
            >
              {t("explore.empty")}
            </EmptyState>
          ) : (
            <>
              <ol className={styles.list} role="list">
                {ideas.map((idea) => (
                  <li key={idea.id}>
                    <IdeaCard
                      idea={idea}
                      layout="row"
                      topicNames={topicNames}
                      dimensions={LENS_DIMENSIONS[lens] ?? DEFAULT_CARD_DIMENSIONS}
                    />
                  </li>
                ))}
              </ol>
              {query.hasNextPage && (
                <div className={styles.more}>
                  <Button onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
                    {t("explore.more")}
                  </Button>
                </div>
              )}
              <p className={styles.legend}>
                {t("explore.measureLegend", { minimum: MIN_RATINGS_FOR_CONFIDENCE })}
              </p>
            </>
          )}
        </section>
      </div>

      <Dialog
        open={sheet}
        onClose={() => setSheet(false)}
        size="sm"
        title={t("explore.filters")}
        footer={
          <Button variant="primary" onClick={() => setSheet(false)}>
            {count ? t("explore.showCount", { results: count }) : t("explore.showResults")}
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
  const t = useMessage();
  const topics = useQuery(useTopicsQueryOptions());
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
        <span className={stacked ? styles.filterLabel : "visually-hidden"}>{t("explore.words")}</span>
        <Search aria-hidden className={styles.wordsIcon} />
        <input
          className={control}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("explore.wordsPlaceholder")}
        />
      </label>
      <label>
        <span className={stacked ? styles.filterLabel : "visually-hidden"}>{t("explore.topic")}</span>
        <select
          className={control}
          value={search.topic ?? ""}
          onChange={(e) => onChange({ topic: e.target.value || undefined })}
        >
          <option value="">{t("explore.allTopics")}</option>
          {topics.data?.map((topic) => (
            <option key={topic.id} value={topic.slug}>
              {topic.parentId ? "  " : ""}
              {t("explore.topicOption", { topic: topic.name, count: topic.ideaCount })}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={stacked ? styles.filterLabel : "visually-hidden"}>{t("idea.stage")}</span>
        <select
          className={control}
          value={search.stage ?? ""}
          onChange={(e) => onChange({ stage: (e.target.value || undefined) as IdeaStage | undefined })}
        >
          <option value="">{t("explore.anyStage")}</option>
          {IDEA_STAGES.map((s) => (
            <option key={s} value={s}>
              {vocabularyField("stages", s, "label", IDEA_STAGE_INFO[s].label)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ActiveFilters({ search, onChange }: { search: ExploreSearch; onChange: Patch }) {
  const t = useMessage();
  const topics = useQuery(useTopicsQueryOptions());
  const topicName = topics.data?.find((t) => t.slug === search.topic)?.name ?? search.topic;
  const active = [
    search.topic && { key: "topic" as const, label: topicName },
    search.stage && {
      key: "stage" as const,
      label: vocabularyField("stages", search.stage, "label", IDEA_STAGE_INFO[search.stage].label),
    },
    search.tag && { key: "tag" as const, label: `#${search.tag}` },
    search.q && { key: "q" as const, label: t("explore.quotedWords", { words: search.q }) },
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
            aria-label={t("explore.removeFilter", { filter: f.label })}
          >
            <X aria-hidden />
          </button>
        </span>
      ))}
    </span>
  );
}
