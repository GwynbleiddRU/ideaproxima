import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { SOURCE_KIND_INFO } from "@ideaproxima/domain";
import { knowledgeQueries } from "@/api/knowledge";
import { MetaLine, PersonLink, TimeAgo } from "@/components/meta";
import { Badge } from "@/ui/Badge";
import styles from "./knowledge-page.module.scss";

const route = getRouteApi("/sources/$source");

/** A publication, dataset or other source, registered once and cited as evidence wherever relevant. */
export function SourcePage() {
  const { source: id } = route.useParams();
  const source = useSuspenseQuery(knowledgeQueries.source(id)).data;
  const details: [string, string | number | null][] = [
    ["Authors", source.authors],
    ["Venue", source.venue],
    ["Year", source.year],
  ];
  return (
    <div className="container">
      <title>{`${source.title} · ideaproxima`}</title>
      <header className={styles.header}>
        <p className="eyebrow">Source</p>
        <div className={styles.badges}>
          <Badge tone="outline">{SOURCE_KIND_INFO[source.kind].label}</Badge>
          <Badge tone="primary">
            Cited as evidence {source.citedBy} time{source.citedBy === 1 ? "" : "s"}
          </Badge>
        </div>
        <h1 className={styles.statement}>{source.title}</h1>
        <dl className={styles.details}>
          {details
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          {source.doi && (
            <div>
              <dt>DOI</dt>
              <dd>
                <a
                  href={`https://doi.org/${source.doi}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="link"
                >
                  {source.doi} <ExternalLink size={12} aria-hidden />
                </a>
              </dd>
            </div>
          )}
          {source.url && (
            <div>
              <dt>Link</dt>
              <dd>
                <a href={source.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="link">
                  {source.url} <ExternalLink size={12} aria-hidden />
                </a>
              </dd>
            </div>
          )}
        </dl>
        <MetaLine>
          <span>
            Registered by <PersonLink person={source.registeredBy} />
          </span>
          <TimeAgo iso={source.createdAt} />
        </MetaLine>
        <p className={styles.explain}>
          Sources are deduplicated by DOI and URL, so every claim citing this work points to the same record.
        </p>
      </header>
    </div>
  );
}
