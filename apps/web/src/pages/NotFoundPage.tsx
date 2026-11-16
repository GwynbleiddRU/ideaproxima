import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button, ButtonLink } from "@/ui/Button";
import styles from "./NotFoundPage.module.scss";

export function NotFoundPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (q.trim()) void navigate({ to: "/search", search: { q: q.trim() } });
  };
  return (
    <section className={styles.page}>
      <title>Not found · ideaproxima</title>
      <p className="eyebrow">404</p>
      <h1 className={styles.title}>Nothing is archived here.</h1>
      <p className={styles.body}>
        The page may have moved, or the content was hidden by moderation. Hidden content stays in the record;
        the public moderation log explains why.
      </p>
      {/* A dead link should still lead somewhere: search for what you were looking for. */}
      <form role="search" className={styles.search} onSubmit={submit}>
        <Search aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for what you were looking for"
          aria-label="Search for what you were looking for"
        />
        <Button type="submit" size="sm" variant="primary">
          Search
        </Button>
      </form>
      <div className={styles.actions}>
        <ButtonLink to="/explore" variant="secondary">
          Explore ideas
        </ButtonLink>
        <ButtonLink to="/activity" search={{ action: "moderation." }} variant="quiet">
          Moderation log
        </ButtonLink>
      </div>
    </section>
  );
}
