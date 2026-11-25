import { useMessage } from "@/locales/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { useCreateTopic, useTopicsQueryOptions } from "@/api/catalog";
import { isApiError } from "@/api/http";
import { useSession } from "@/api/session";
import forms from "@/components/forms.module.scss";
import { PageHeader } from "@/components/PageHeader";
import { cx } from "@/lib/cx";
import { formatCount } from "@/locales/runtime";
import { topicIcon } from "@/lib/topic-icons";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import styles from "./topics.module.scss";

export function TopicsPage() {
  const t = useMessage();
  const topics = useSuspenseQuery(useTopicsQueryOptions()).data;
  const { isAdmin } = useSession();
  const [creating, setCreating] = useState(false);
  const roots = topics.filter((t) => !t.parentId);
  // Active domains first; the editorial order breaks ties and orders the empty ones.
  const sorted = [...roots].sort((a, b) => b.ideaCount - a.ideaCount);
  const childrenOf = (id: string) => topics.filter((t) => t.parentId === id);

  return (
    <div className="container">
      <title>{t("common.pageTitle", { title: t("nav.topics") })}</title>
      <PageHeader
        title={t("nav.topics")}
        lede={t("topics.lede")}
        actions={
          isAdmin && (
            <Button icon={<Plus />} onClick={() => setCreating(true)}>
              {t("topics.newTopic")}
            </Button>
          )
        }
      />
      <ul className={styles.grid} role="list">
        {sorted.map((topic) => {
          const Icon = topicIcon(topic.slug);
          const children = childrenOf(topic.id);
          const empty = topic.ideaCount === 0;
          return (
            <li key={topic.id} className={cx(styles.topic, empty && styles.topicEmpty)}>
              <div className={styles.topicHead}>
                <span className={styles.icon} aria-hidden>
                  <Icon />
                </span>
                <h2 className={styles.name}>
                  <Link to="/topics/$slug" params={{ slug: topic.slug }} className={styles.stretched}>
                    {topic.name}
                  </Link>
                </h2>
                <span className={styles.count}>
                  {empty ? "—" : formatCount("count.idea", topic.ideaCount)}
                </span>
              </div>
              <p className={styles.description}>{topic.description}</p>
              {children.length > 0 && (
                <p className={styles.children}>{children.map((c) => c.name).join(" · ")}</p>
              )}
              <div className={styles.latest}>
                {empty ? (
                  <>
                    <span className={styles.latestLabel}>{t("topics.noIdeasYet")}</span>
                    <Link to="/new" className={styles.invite}>
                      {t("topics.proposeTheFirst")} <ArrowRight aria-hidden />
                    </Link>
                  </>
                ) : (
                  <>
                    <span className={styles.latestLabel}>{t("topics.newest")}</span>
                    {topic.latestIdeas.map((idea) => (
                      <Link
                        key={idea.id}
                        to="/ideas/$idea"
                        params={{ idea: idea.slug }}
                        className={styles.latestIdea}
                      >
                        {idea.title}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {isAdmin && <CreateTopicDialog open={creating} onClose={() => setCreating(false)} parents={roots} />}
    </div>
  );
}

function CreateTopicDialog({
  open,
  onClose,
  parents,
}: {
  open: boolean;
  onClose: () => void;
  parents: { slug: string; name: string }[];
}) {
  const t = useMessage();
  const create = useCreateTopic();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentSlug, setParentSlug] = useState("");
  const errors = isApiError(create.error) ? create.error.fieldErrors : {};
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        parentSlug: parentSlug || undefined,
      },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          onClose();
        },
      },
    );
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={t("topics.newTopic")}
      description={t("topics.createDescription")}
    >
      <form onSubmit={submit} className={forms.form}>
        <Field label={t("auth.name")} error={errors.name}>
          {(p) => (
            <input
              {...p}
              className={control}
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
          )}
        </Field>
        <Field label={t("topics.description")} optional>
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          )}
        </Field>
        <Field label={t("topics.nestUnder")} optional>
          {(p) => (
            <select
              {...p}
              className={control}
              value={parentSlug}
              onChange={(e) => setParentSlug(e.target.value)}
            >
              <option value="">{t("topics.topLevel")}</option>
              {parents.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <FormError error={create.error} />
        <div className={forms.actions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" retryError={create.error} loading={create.isPending}>
            {t("topics.createTopic")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
