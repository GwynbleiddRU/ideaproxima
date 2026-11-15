import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { catalogQueries } from "@/api/catalog";
import { IdeaCard } from "@/components/IdeaCard";
import { PageHeader, SectionHeading } from "@/components/PageHeader";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { controlLarge } from "@/ui/Field";
import { EmptyState, ErrorState, Skeleton } from "@/ui/Feedback";
import styles from "./SearchPage.module.scss";

/** Full-text search across ideas, claims, sources and people. */
export function SearchPage() {
  const { q = "" } = useSearch({ from: "/search" });
  const navigate = useNavigate({ from: "/search" });
  const [input, setInput] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setInput(q);
  }
  const results = useQuery(catalogQueries.search(q));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void navigate({ search: { q: input.trim() || undefined } });
  };
  const data = results.data;
  const total = data ? data.ideas.length + data.claims.length + data.sources.length + data.people.length : 0;

  return (
    <div className="container">
      <title>{q ? `“${q}” · Search · ideaproxima` : "Search · ideaproxima"}</title>
      <PageHeader eyebrow="Search" title="Search the archive" />
      <form role="search" onSubmit={submit} className={styles.form}>
        <input
          className={controlLarge}
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ideas, claims, sources, people…"
          aria-label="Search"
          autoFocus
        />
        <Button type="submit" variant="primary" icon={<Search />}>
          Search
        </Button>
      </form>

      {!q ? (
        <p className={styles.hint}>
          Search by words in titles, summaries, claim statements, source titles and names.
        </p>
      ) : results.isPending ? (
        <Skeleton lines={8} />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : total === 0 ? (
        <EmptyState icon={<Search />} title={`Nothing found for “${q}”`}>
          Try fewer or different words. If the idea is not here yet, it may be yours to propose.
        </EmptyState>
      ) : (
        <div className={styles.results}>
          {data!.ideas.length > 0 && (
            <section>
              <SectionHeading title={`Ideas (${data!.ideas.length})`} />
              <div>
                {data!.ideas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} layout="row" />
                ))}
              </div>
            </section>
          )}
          <div className={styles.side}>
            {data!.claims.length > 0 && (
              <section>
                <SectionHeading title={`Claims (${data!.claims.length})`} />
                <ul className={styles.list} role="list">
                  {data!.claims.map((c) => (
                    <li key={c.id}>
                      <Link to="/claims/$claim" params={{ claim: c.id }} className={styles.claim}>
                        {c.statement}
                      </Link>
                      <span className={styles.meta}>
                        Underpins {c.ideaCount} idea{c.ideaCount === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data!.sources.length > 0 && (
              <section>
                <SectionHeading title={`Sources (${data!.sources.length})`} />
                <ul className={styles.list} role="list">
                  {data!.sources.map((s) => (
                    <li key={s.id}>
                      <Link to="/sources/$source" params={{ source: s.id }} className={styles.claim}>
                        {s.title}
                      </Link>
                      <span className={styles.meta}>{[s.authors, s.year].filter(Boolean).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data!.people.length > 0 && (
              <section>
                <SectionHeading title={`People (${data!.people.length})`} />
                <ul className={styles.list} role="list">
                  {data!.people.map((p) => (
                    <li key={p.id}>
                      <Link to="/people/$handle" params={{ handle: p.handle }} className={styles.person}>
                        <Avatar name={p.displayName} seed={p.handle} size={28} />
                        <span>
                          {p.displayName} <span className={styles.meta}>@{p.handle}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
