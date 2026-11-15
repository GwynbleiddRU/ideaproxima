import { ButtonLink } from "@/ui/Button";
import styles from "./NotFoundPage.module.scss";

export function NotFoundPage() {
  return (
    <section className={styles.page}>
      <title>Not found · ideaproxima</title>
      <p className="eyebrow">404</p>
      <h1 className={styles.title}>Nothing is archived here.</h1>
      <p className={styles.body}>
        The page may have moved, or the content was hidden by moderation. Hidden content stays in the record;
        the public moderation log explains why.
      </p>
      <div className={styles.actions}>
        <ButtonLink to="/explore" variant="primary">
          Explore ideas
        </ButtonLink>
        <ButtonLink to="/activity" search={{ action: "moderation." }} variant="secondary">
          Moderation log
        </ButtonLink>
      </div>
    </section>
  );
}
