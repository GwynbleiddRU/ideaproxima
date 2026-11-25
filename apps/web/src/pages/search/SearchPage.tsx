import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { BookOpen, FileText, Lightbulb, Plus, Search, X } from "lucide-react";
import type { SearchResults } from "@ideaproxima/contracts";
import { SOURCE_KIND_INFO } from "@ideaproxima/domain";
import { catalogQueries, useTopicsQueryOptions } from "@/api/catalog";
import { IdeaCard } from "@/components/IdeaCard";
import { ClaimStatusBadge } from "@/components/status";
import { cx } from "@/lib/cx";
import type { MessageId } from "@/locales/messages";
import { formatNumber } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Button, ButtonLink } from "@/ui/Button";
import { ChipLink } from "@/ui/Chip";
import { EmptyState, ErrorState, Skeleton } from "@/ui/Feedback";
import styles from "./SearchPage.module.scss";

type Kind = "all" | keyof SearchResults;
const KINDS: { key: Kind; label: MessageId }[] = [
  { key: "all", label: "search.allTypes" },
  { key: "ideas", label: "search.ideas" },
  { key: "claims", label: "search.claims" },
  { key: "sources", label: "search.sources" },
  { key: "people", label: "search.people" },
];

/** Marks the query's words (and words starting with them) in a text. Best effort: search itself also stems. */
function highlight(text: string, q: string): ReactNode {
  const words = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);
  if (!words.length) return text;
  const pattern = new RegExp(
    `(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[\\p{L}\\p{N}]*`,
    "giu",
  );
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(last, match.index), <mark key={match.index}>{match[0]}</mark>);
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

/** Search across ideas, claims, sources and people — the search box is the page. */
export function SearchPage() {
  const t = useMessage();
  const { q = "" } = useSearch({ from: "/search" });
  const navigate = useNavigate({ from: "/search" });
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  const [kind, setKind] = useState<Kind>("all");
  if (q !== lastQ) {
    setLastQ(q);
    setValue(q);
    setKind("all");
  }
  const results = useQuery(catalogQueries.search(q));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void navigate({ search: { q: value.trim() || undefined } });
  };

  return (
    <div className={cx("container", styles.page)}>
      <title>
        {t("common.pageTitle", { title: q ? t("search.queryTitle", { query: q }) : t("nav.search") })}
      </title>
      <h1 className="visually-hidden">{t("nav.searchLabel")}</h1>
      <form role="search" onSubmit={submit} className={styles.box}>
        <Search aria-hidden className={styles.boxIcon} />
        <input
          ref={input}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("nav.searchLabel")}
          enterKeyHint="search"
          autoFocus
        />
        {value && (
          <button
            type="button"
            className={styles.clear}
            aria-label={t("search.clearTheSearch")}
            onClick={() => {
              setValue("");
              input.current?.focus();
            }}
          >
            <X aria-hidden />
          </button>
        )}
        <Button type="submit" variant="primary" size="sm">
          {t("nav.search")}
        </Button>
      </form>

      {!q ? (
        <StartHere />
      ) : results.isPending ? (
        <Skeleton lines={8} />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : (
        <Results data={results.data} q={q} kind={kind} onKind={setKind} />
      )}
    </div>
  );
}

function Results({
  data,
  q,
  kind,
  onKind,
}: {
  data: SearchResults;
  q: string;
  kind: Kind;
  onKind: (kind: Kind) => void;
}) {
  const t = useMessage();
  const topics = useQuery(useTopicsQueryOptions());
  const total = data.ideas.length + data.claims.length + data.sources.length + data.people.length;
  const count = (k: Kind) => (k === "all" ? total : data[k].length);
  const show = (k: keyof SearchResults) => (kind === "all" || kind === k) && data[k].length > 0;
  const topic = topics.data?.find((t) => q.toLowerCase().includes(t.name.toLowerCase()));

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label={t("search.resultTypes")}>
        {KINDS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={kind === key}
            disabled={key !== "all" && count(key) === 0}
            className={styles.tab}
            onClick={() => onKind(key)}
          >
            {t(label)} <span className={styles.tabCount}>{formatNumber(count(key))}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className={styles.results}>
        {total === 0 && (
          <EmptyState icon={<Search />} title={t("search.empty", { query: q })}>
            {t("search.emptyHelp")}
          </EmptyState>
        )}

        {show("ideas") && (
          <section aria-labelledby="r-ideas">
            <h2 id="r-ideas" className={styles.group}>
              {t("search.ideas")}
            </h2>
            <ol className={styles.list} role="list">
              {data.ideas.map((idea) => (
                <li key={idea.id}>
                  <IdeaCard idea={idea} layout="row" />
                </li>
              ))}
            </ol>
          </section>
        )}

        {show("claims") && (
          <section aria-labelledby="r-claims">
            <h2 id="r-claims" className={styles.group}>
              {t("search.claims")}
            </h2>
            <ol className={styles.list} role="list">
              {data.claims.map((c) => (
                <li key={c.id} className={styles.result}>
                  <span className={styles.resultIcon} aria-hidden>
                    <FileText />
                  </span>
                  <Link to="/claims/$claim" params={{ claim: c.id }} className={styles.resultTitle}>
                    {highlight(c.statement, q)}
                  </Link>
                  <span className={styles.resultMeta}>
                    <ClaimStatusBadge status={c.status} />
                    {t("claimPage.underpinsCount", { count: c.ideaCount })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {show("sources") && (
          <section aria-labelledby="r-sources">
            <h2 id="r-sources" className={styles.group}>
              {t("search.sources")}
            </h2>
            <ol className={styles.list} role="list">
              {data.sources.map((s) => (
                <li key={s.id} className={styles.result}>
                  <span className={styles.resultIcon} aria-hidden>
                    <BookOpen />
                  </span>
                  <Link to="/sources/$source" params={{ source: s.id }} className={styles.resultTitle}>
                    {highlight(s.title, q)}
                  </Link>
                  <span className={styles.resultMeta}>
                    {[
                      vocabularyField("sourceKinds", s.kind, "label", SOURCE_KIND_INFO[s.kind].label),
                      s.authors,
                      s.year,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {show("people") && (
          <section aria-labelledby="r-people">
            <h2 id="r-people" className={styles.group}>
              {t("search.people")}
            </h2>
            <ol className={styles.list} role="list">
              {data.people.map((p) => (
                <li key={p.id} className={styles.result}>
                  <Avatar name={p.displayName} seed={p.handle} size={36} />
                  <Link to="/people/$handle" params={{ handle: p.handle }} className={styles.resultTitle}>
                    {highlight(p.displayName, q)}
                  </Link>
                  <span className={styles.resultMeta}>@{p.handle}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {data.ideas.length === 0 && kind === "all" && (
          <aside className={styles.noIdeas} aria-label={t("search.noMatchingIdeas")}>
            <p className={styles.noIdeasTitle}>
              <Lightbulb aria-hidden /> {t("search.noMatchingIdea", { query: q })}
            </p>
            <p>
              {topic ? (
                <LocalizedText
                  id="search.browseTopic"
                  components={{
                    0: (
                      <Link to="/topics/$slug" params={{ slug: topic.slug }} className="link">
                        {topic.name}
                      </Link>
                    ),
                  }}
                />
              ) : (
                <>{t("search.proposeHelp")}</>
              )}
            </p>
            <ButtonLink to="/new" variant="primary" size="sm">
              <Plus /> {t("nav.propose")}
            </ButtonLink>
          </aside>
        )}

        <p className={styles.tips}>
          <LocalizedText id="search.examples" components={{ 0: <code />, 1: <code />, 2: <code /> }} />
        </p>
      </div>
    </>
  );
}

/** Before a query: ways in, so the empty page still leads somewhere. */
function StartHere() {
  const t = useMessage();
  const topics = useQuery(useTopicsQueryOptions());
  const active = (topics.data ?? []).filter((t) => !t.parentId && t.ideaCount > 0).slice(0, 8);
  return (
    <div className={styles.start}>
      <p>{t("search.intro")}</p>
      <div className={styles.chips}>
        {active.map((t) => (
          <ChipLink key={t.id} to="/topics/$slug" params={{ slug: t.slug }}>
            {t.name}
          </ChipLink>
        ))}
        <ChipLink to="/explore">{t("search.exploreAllIdeas")}</ChipLink>
      </div>
    </div>
  );
}
