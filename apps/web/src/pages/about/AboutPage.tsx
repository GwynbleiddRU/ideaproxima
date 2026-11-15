import { Link } from "@tanstack/react-router";
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_INFO,
  IDEA_STAGE_INFO,
  IDEA_STAGES,
  LENS_INFO,
} from "@ideaproxima/domain";
import { PageHeader, SectionHeading } from "@/components/PageHeader";
import { ClaimStatusBadge } from "@/components/status";
import { LENS_GROUPS, MIN_RATINGS_FOR_CONFIDENCE, SIGNAL_INFO } from "@/lib/vocabulary";
import { ButtonLink } from "@/ui/Button";
import styles from "./AboutPage.module.scss";

const PRINCIPLES = [
  {
    title: "Ideas deserve preservation",
    body: "An idea does not need to be feasible, proven or popular to be kept. Some are developed decades before the technology or social conditions they need exist.",
  },
  {
    title: "Popularity is not quality",
    body: "Attention shows what people care about. It never decides what is true, feasible or valuable, and it is never blended into the assessed measures.",
  },
  {
    title: "Uncertainty stays visible",
    body: `Ratings show their spread and their number. Below ${MIN_RATINGS_FOR_CONFIDENCE} independent ratings, a measure says “too early to tell”. Absence of data is never shown as a low score.`,
  },
  {
    title: "Facts are never rewritten",
    body: "Revisions, ratings, evidence and stage changes are append-only. Corrections supersede; withdrawals are marked; moderation hides but never deletes, and is logged publicly.",
  },
  {
    title: "Knowledge, not posts",
    body: "Ideas are made of shared claims, evidence with stated limitations, arguments, typed connections to other ideas, and recorded real-world initiatives, including failures.",
  },
  {
    title: "Contribution, not hierarchy",
    body: "Reputation will reflect demonstrated contribution: useful criticism, evidence, accurate judgment. It is a measure of contribution, never of intelligence.",
  },
];

export function AboutPage() {
  return (
    <div className="container">
      <title>Principles · ideaproxima</title>
      <PageHeader
        eyebrow="Principles"
        title="A collective memory of humanity's attempts to imagine its future"
        lede="ideaproxima connects ideas with the people capable of advancing them: the scientist who finds a direction worth researching, the engineer a concept worth building, the funder an opportunity worth backing."
      />

      <section className={styles.principles}>
        {PRINCIPLES.map((p, i) => (
          <article key={p.title}>
            <span className={styles.number}>{String(i + 1).padStart(2, "0")}</span>
            <h2>{p.title}</h2>
            <p>{p.body}</p>
          </article>
        ))}
      </section>

      <section className={styles.section}>
        <SectionHeading eyebrow="What has been done" title="Six lifecycle stages" />
        <p className={styles.lede}>
          The unit of value is progression. Later stages require proof: a recorded experiment, deployment or
          outcome. The stage says what was done, not what is known.
        </p>
        <ol className={styles.stages} role="list">
          {IDEA_STAGES.map((s) => (
            <li key={s}>
              <strong>{IDEA_STAGE_INFO[s].label}</strong>
              <span>{IDEA_STAGE_INFO[s].description}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <SectionHeading eyebrow="What is known" title="How claims are judged" />
        <p className={styles.lede}>
          Ideas rest on claims. A claim's status is derived from independent assessments and the evidence
          attached to it. It is never typed in by anyone.
        </p>
        <dl className={styles.statuses}>
          {CLAIM_STATUSES.map((s) => (
            <div key={s}>
              <dt>
                <ClaimStatusBadge status={s} />
              </dt>
              <dd>{CLAIM_STATUS_INFO[s].description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section}>
        <SectionHeading eyebrow="How to discover" title="Lenses instead of one ranking" />
        <div className={styles.lenses}>
          {LENS_GROUPS.map((group) => (
            <div key={group.signal}>
              <h3>{SIGNAL_INFO[group.signal].label}</h3>
              <p className={styles.signal}>{SIGNAL_INFO[group.signal].description}</p>
              <ul role="list">
                {group.lenses.map((key) => (
                  <li key={key}>
                    <Link to="/explore" search={{ lens: key }} className="link">
                      {LENS_INFO[key].label}
                    </Link>
                    <span>{LENS_INFO[key].description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <p>
          The current measures are a transparent baseline. A reputation-weighted system, where people who have
          shown good judgment in a domain count for more there, is planned. It will be labelled wherever it is
          used.
        </p>
        <div className={styles.actions}>
          <ButtonLink to="/explore" variant="primary">
            Start exploring
          </ButtonLink>
          <ButtonLink to="/new" variant="secondary">
            Propose an idea
          </ButtonLink>
          <a href="/v1/openapi.json" className="link">
            Open API (OpenAPI 3.1)
          </a>
        </div>
      </section>
    </div>
  );
}
