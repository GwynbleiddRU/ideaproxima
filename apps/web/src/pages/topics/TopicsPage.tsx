import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { catalogQueries, useCreateTopic } from "@/api/catalog";
import { isApiError } from "@/api/http";
import { useSession } from "@/api/session";
import forms from "@/components/forms.module.scss";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import styles from "./topics.module.scss";

export function TopicsPage() {
  const topics = useSuspenseQuery(catalogQueries.topics()).data;
  const { isAdmin } = useSession();
  const [creating, setCreating] = useState(false);
  const roots = topics.filter((t) => !t.parentId);
  const childrenOf = (id: string) => topics.filter((t) => t.parentId === id);

  return (
    <div className="container">
      <title>Topics · ideaproxima</title>
      <PageHeader
        eyebrow="Topics"
        title="Domains of possibility"
        lede="Ideas span domains: each belongs to up to four topics, the first being its primary home."
        actions={
          isAdmin && (
            <Button icon={<Plus />} onClick={() => setCreating(true)}>
              New topic
            </Button>
          )
        }
      />
      <ul className={styles.grid} role="list">
        {roots.map((topic) => (
          <li key={topic.id}>
            <Link to="/topics/$slug" params={{ slug: topic.slug }} className={styles.topic}>
              <span className={styles.count}>{topic.ideaCount}</span>
              <span className={styles.name}>{topic.name}</span>
              <span className={styles.description}>{topic.description}</span>
              {childrenOf(topic.id).length > 0 && (
                <span className={styles.children}>
                  {childrenOf(topic.id)
                    .map((c) => c.name)
                    .join(" · ")}
                </span>
              )}
            </Link>
          </li>
        ))}
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
      title="New topic"
      description="Topic changes are recorded in the public activity log."
    >
      <form onSubmit={submit} className={forms.form}>
        <Field label="Name" error={errors.name}>
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
        <Field label="Description" optional>
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
        <Field label="Nest under" optional>
          {(p) => (
            <select
              {...p}
              className={control}
              value={parentSlug}
              onChange={(e) => setParentSlug(e.target.value)}
            >
              <option value="">Top level</option>
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
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create topic
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
