import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { errorMessage } from "@/api/http";
import { Button, ButtonLink } from "@/ui/Button";
import styles from "@/pages/NotFoundPage.module.scss";

/** Shown when a page fails to load (network, server error). Offers a retry that re-runs the loaders. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <section className={styles.page}>
      <title>Something went wrong · ideaproxima</title>
      <p className="eyebrow">Something went wrong</p>
      <h1 className={styles.title}>This page could not be loaded.</h1>
      <p className={styles.body}>{errorMessage(error)}</p>
      <div className={styles.actions}>
        <Button
          variant="primary"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Try again
        </Button>
        <ButtonLink to="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </section>
  );
}
