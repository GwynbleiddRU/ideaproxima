import { useMessage } from "@/locales/react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { errorMessage } from "@/api/http";
import { Button, ButtonLink } from "@/ui/Button";
import styles from "@/pages/NotFoundPage.module.scss";

/** Shown when a page fails to load (network, server error). Offers a retry that re-runs the loaders. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const t = useMessage();
  const router = useRouter();
  return (
    <section className={styles.page}>
      <title>{t("common.pageTitle", { title: t("error.route.eyebrow") })}</title>
      <p className="eyebrow">{t("error.route.eyebrow")}</p>
      <h1 className={styles.title}>{t("error.route.title")}</h1>
      <p className={styles.body}>{errorMessage(error)}</p>
      <div className={styles.actions}>
        <Button
          variant="primary"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          {t("feedback.tryAgain")}
        </Button>
        <ButtonLink to="/" variant="secondary">
          {t("error.route.goHome")}
        </ButtonLink>
      </div>
    </section>
  );
}
