import { formatPaddedNumber } from "@/lib/format";
import { vocabularyField } from "@/lib/vocabulary";
import { useMessage } from "@/locales/react";
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
import { LENS_GROUPS, MIN_RATINGS_FOR_CONFIDENCE } from "@/lib/vocabulary";
import { ButtonLink } from "@/ui/Button";
import styles from "./AboutPage.module.scss";

const PRINCIPLES = [
  {
    title: "about.principle.ideas.deserve.title",
    body: "about.principle.ideas.deserve.body",
  },
  {
    title: "about.principle.popularity.is.title",
    body: "about.principle.popularity.is.body",
  },
  {
    title: "about.principle.uncertainty.stays.title",
    body: "about.principle.uncertainty.stays.body",
  },
  {
    title: "about.principle.facts.are.title",
    body: "about.principle.facts.are.body",
  },
  {
    title: "about.principle.knowledge.not.title",
    body: "about.principle.knowledge.not.body",
  },
  {
    title: "about.principle.contribution.not.title",
    body: "about.principle.contribution.not.body",
  },
] as const;

export function AboutPage() {
  const t = useMessage();
  return (
    <div className="container">
      <title>{t("common.pageTitle", { title: t("nav.principles") })}</title>
      <PageHeader eyebrow={t("nav.principles")} title={t("about.title")} lede={t("about.lede")} />

      <section className={styles.principles}>
        {PRINCIPLES.map((p, i) => (
          <article key={p.title}>
            <span className={styles.number}>{formatPaddedNumber(i + 1)}</span>
            <h2>{t(p.title)}</h2>
            <p>{t(p.body, { count: MIN_RATINGS_FOR_CONFIDENCE })}</p>
          </article>
        ))}
      </section>

      <section id="stages" className={styles.section}>
        <SectionHeading eyebrow={t("about.whatHasBeenDone")} title={t("about.sixLifecycleStages")} />
        <p className={styles.lede}>{t("about.stagesDescription")}</p>
        <ol className={styles.stages} role="list">
          {IDEA_STAGES.map((s) => (
            <li key={s}>
              <strong>{vocabularyField("stages", s, "label", IDEA_STAGE_INFO[s].label)}</strong>
              <span>{vocabularyField("stages", s, "description", IDEA_STAGE_INFO[s].description)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <SectionHeading eyebrow={t("about.whatIsKnown")} title={t("about.howClaimsAreJudged")} />
        <p className={styles.lede}>{t("about.claimsDescription")}</p>
        <dl className={styles.statuses}>
          {CLAIM_STATUSES.map((s) => (
            <div key={s}>
              <dt>
                <ClaimStatusBadge status={s} />
              </dt>
              <dd>{vocabularyField("claimStatuses", s, "description", CLAIM_STATUS_INFO[s].description)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section}>
        <SectionHeading eyebrow={t("about.howToDiscover")} title={t("about.lensesTitle")} />
        <div className={styles.lenses}>
          {LENS_GROUPS.map((group) => (
            <div key={group.signal}>
              <h3>{t(`lensSignal.${group.signal}.label`)}</h3>
              <p className={styles.signal}>{t(`lensSignal.${group.signal}.description`)}</p>
              <ul role="list">
                {group.lenses.map((key) => (
                  <li key={key}>
                    <Link to="/explore" search={{ lens: key }} className="link">
                      {vocabularyField("lenses", key, "label", LENS_INFO[key].label)}
                    </Link>
                    <span>{vocabularyField("lenses", key, "description", LENS_INFO[key].description)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <p>{t("about.lensesDescription")}</p>
        <div className={styles.actions}>
          <ButtonLink to="/explore" variant="primary">
            {t("about.startExploring")}
          </ButtonLink>
          <ButtonLink to="/new" variant="secondary">
            {t("nav.propose")}
          </ButtonLink>
          <a href="/v1/openapi.json" className="link">
            {t("about.openApiOpenapi3")}
          </a>
        </div>
      </section>
    </div>
  );
}
