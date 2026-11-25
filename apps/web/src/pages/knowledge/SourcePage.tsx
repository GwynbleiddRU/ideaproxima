import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
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
  const t = useMessage();
  const { source: id } = route.useParams();
  const source = useSuspenseQuery(knowledgeQueries.source(id)).data;
  const details: [string, string | number | null][] = [
    [t("sourcePage.authors"), source.authors],
    [t("sourcePage.venue"), source.venue],
    [t("sourcePage.year"), source.year],
  ];
  return (
    <div className="container">
      <title>{t("common.pageTitle", { title: source.title })}</title>
      <header className={styles.header}>
        <p className="eyebrow">{t("sourcePage.source")}</p>
        <div className={styles.badges}>
          <Badge tone="outline">
            {vocabularyField("sourceKinds", source.kind, "label", SOURCE_KIND_INFO[source.kind].label)}
          </Badge>
          <Badge tone="primary">{t("sourcePage.citationCount", { count: source.citedBy })}</Badge>
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
              <dt>{t("idea.claim.doi")}</dt>
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
              <dt>{t("idea.claim.link")}</dt>
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
            <LocalizedText
              id="sourcePage.registeredByPerson"
              components={{ 0: <PersonLink person={source.registeredBy} /> }}
            />
          </span>
          <TimeAgo iso={source.createdAt} />
        </MetaLine>
        <p className={styles.explain}>{t("sourcePage.deduplicationHelp")}</p>
      </header>
    </div>
  );
}
