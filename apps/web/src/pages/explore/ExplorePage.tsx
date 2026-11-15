import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, X } from "lucide-react";
import { IDEA_STAGE_INFO, IDEA_STAGES, LENS_INFO, type IdeaStage } from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { ideaQueries } from "@/api/ideas";
import type { ExploreSearch } from "@/app/search-params";
import { IdeaCard } from "@/components/IdeaCard";
import { PageHeader } from "@/components/PageHeader";
import { cx } from "@/lib/cx";
import { DEFAULT_CARD_DIMENSIONS, LENS_DIMENSIONS, LENS_GROUPS, SIGNAL_INFO } from "@/lib/vocabulary";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { control } from "@/ui/Field";
import { EmptyState, ErrorState, Skeleton } from "@/ui/Feedback";
import styles from "./ExplorePage.module.scss";

export function ExplorePage() {
  const search = useSearch({ from: "/explore" });
  const navigate = useNavigate({ from: "/explore" });
  const lens = search.lens ?? "newest";
  const info = LENS_INFO[lens];
  const setSearch = (patch: Partial<ExploreSearch>, replace = false) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace });

  return (
    <div className="container">
      <title>{`${info.label} · Explore · ideaproxima`}</title>
      <PageHeader
        eyebrow="Explore"
        title="Discover possible futures"
        lede="Choose a lens. Each one ranks on a single, named signal, and says so. Combine it with a topic or a stage to narrow down."
      />
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Lenses and filters">
          <nav className={styles.lensNav} aria-label="Lenses">
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
                    className={cx(styles.lensLink, key === lens && styles.lensActive)}
                    aria-current={key === lens ? "page" : undefined}
                  >
                    {LENS_INFO[key].label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <Filters search={search} onChange={setSearch} />
        </aside>
        <section aria-live="polite" className={styles.results}>
          <div className={styles.lensBanner}>
            <Badge
              tone={
                info.signal === "attention" ? "warning" : info.signal === "quality" ? "primary" : "neutral"
              }
            >
              {SIGNAL_INFO[info.signal].label}
            </Badge>
            <div>
              <h2 className={styles.lensTitle}>{info.label}</h2>
              <p className={styles.lensDescription}>
                <strong>What this measures:</strong> {info.description}
              </p>
            </div>
          </div>
          <ActiveFilters search={search} onChange={setSearch} />
          <Results search={search} />
        </section>
      </div>
    </div>
  );
}

function Filters({
  search,
  onChange,
}: {
  search: ExploreSearch;
  onChange: (patch: Partial<ExploreSearch>, replace?: boolean) => void;
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
    <div className={styles.filters}>
      <label className={styles.filter}>
        <span>Contains</span>
        <input
          className={control}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Words in title or text"
        />
      </label>
      <label className={styles.filter}>
        <span>Topic</span>
        <select
          className={control}
          value={search.topic ?? ""}
          onChange={(e) => onChange({ topic: e.target.value || undefined })}
        >
          <option value="">All topics</option>
          {topics.data?.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name} ({t.ideaCount})
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filter}>
        <span>Stage</span>
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

function ActiveFilters({
  search,
  onChange,
}: {
  search: ExploreSearch;
  onChange: (patch: Partial<ExploreSearch>) => void;
}) {
  const active = [
    search.topic && { key: "topic" as const, label: `Topic: ${search.topic}` },
    search.stage && { key: "stage" as const, label: `Stage: ${IDEA_STAGE_INFO[search.stage].label}` },
    search.tag && { key: "tag" as const, label: `Tag: ${search.tag}` },
    search.q && { key: "q" as const, label: `“${search.q}”` },
  ].filter((f): f is { key: "topic" | "stage" | "tag" | "q"; label: string } => !!f);
  if (!active.length) return null;
  return (
    <div className={styles.active}>
      {active.map((f) => (
        <Chip
          key={f.key}
          pressed
          onClick={() => onChange({ [f.key]: undefined })}
          aria-label={`Remove ${f.label}`}
        >
          {f.label} <X aria-hidden />
        </Chip>
      ))}
    </div>
  );
}

function Results({ search }: { search: ExploreSearch }) {
  const lens = search.lens ?? "newest";
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
  if (query.isPending) return <Skeleton lines={10} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const ideas = query.data.pages.flatMap((p) => p.items);
  if (!ideas.length) {
    return (
      <EmptyState
        icon={<Compass />}
        title="No ideas match"
        action={
          <ButtonLink to="/explore" variant="secondary">
            Clear filters
          </ButtonLink>
        }
      >
        Lenses based on assessments only include ideas with enough independent ratings. Try another lens, or
        help by evaluating ideas under “Needs review”.
      </EmptyState>
    );
  }
  const ranked = lens !== "newest";
  return (
    <>
      <div className={styles.list}>
        {ideas.map((idea, i) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            layout="row"
            rank={ranked ? i + 1 : undefined}
            dimensions={LENS_DIMENSIONS[lens] ?? DEFAULT_CARD_DIMENSIONS}
          />
        ))}
      </div>
      {query.hasNextPage && (
        <div className={styles.more}>
          <Button onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
            Show more
          </Button>
        </div>
      )}
    </>
  );
}
