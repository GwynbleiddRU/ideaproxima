import { useMessage } from "@/locales/react";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button, ButtonLink } from "@/ui/Button";
import styles from "./NotFoundPage.module.scss";

export function NotFoundPage() {
  const t = useMessage();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (q.trim()) void navigate({ to: "/search", search: { q: q.trim() } });
  };
  return (
    <section className={styles.page}>
      <title>{t("common.pageTitle", { title: t("notFound.title") })}</title>
      <p className="eyebrow">404</p>
      <h1 className={styles.title}>{t("notFound.heading")}</h1>
      <p className={styles.body}>{t("notFound.description")}</p>
      {/* A dead link should still lead somewhere: search for what you were looking for. */}
      <form role="search" className={styles.search} onSubmit={submit}>
        <Search aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("notFound.searchLabel")}
          aria-label={t("notFound.searchLabel")}
        />
        <Button type="submit" size="sm" variant="primary">
          {t("nav.search")}
        </Button>
      </form>
      <div className={styles.actions}>
        <ButtonLink to="/explore" variant="secondary">
          {t("explore.title")}
        </ButtonLink>
        <ButtonLink to="/activity" search={{ action: "moderation." }} variant="quiet">
          {t("nav.moderation")}
        </ButtonLink>
      </div>
    </section>
  );
}
