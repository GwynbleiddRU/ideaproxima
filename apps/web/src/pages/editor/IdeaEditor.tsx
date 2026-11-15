import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import {
  IDEA_SECTION_INFO,
  IDEA_SECTIONS,
  LIMITS,
  normalizeTag,
  type IdeaSectionKey,
} from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { isApiError } from "@/api/http";
import { cx } from "@/lib/cx";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { control, controlLarge, Field } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import styles from "./IdeaEditor.module.scss";

export interface IdeaDraft {
  title: string;
  summary: string;
  sections: Partial<Record<IdeaSectionKey, string>>;
  topics: string[];
  tags: string[];
}

export const emptyDraft: IdeaDraft = { title: "", summary: "", sections: {}, topics: [], tags: [] };

/**
 * The idea editor, shared by "propose" and "edit". Progressive and forgiving: only a title, a summary and a
 * topic are required; every narrative section is optional and shows the question it answers.
 */
export function IdeaEditor({
  initial,
  draftKey,
  submitLabel,
  pending,
  error,
  aside,
  footer,
  onSubmit,
}: {
  initial: IdeaDraft;
  /** localStorage key for keeping an unsent draft; omit to disable. */
  draftKey?: string;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  /** Extra content in the side panel (e.g. how publishing works). */
  aside?: ReactNode;
  /** Extra fields before the submit button (e.g. the change note). */
  footer?: ReactNode;
  onSubmit: (draft: IdeaDraft) => void;
}) {
  const [draft, setDraft] = useState<IdeaDraft>(() => restore(draftKey) ?? initial);
  const topics = useQuery(catalogQueries.topics());
  const [tagInput, setTagInput] = useState("");
  const [openSections, setOpenSections] = useState<Set<IdeaSectionKey>>(
    () => new Set(IDEA_SECTIONS.filter((k) => draft.sections[k]?.trim())),
  );

  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // Storage unavailable: the draft simply isn't kept across reloads.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, draftKey]);

  const errors = fieldErrors(error);
  const patch = (p: Partial<IdeaDraft>) => setDraft((d) => ({ ...d, ...p }));
  const setSection = (key: IdeaSectionKey, value: string) =>
    patch({ sections: { ...draft.sections, [key]: value } });
  const toggleTopic = (slug: string) =>
    patch({
      topics: draft.topics.includes(slug)
        ? draft.topics.filter((t) => t !== slug)
        : draft.topics.length < LIMITS.topicsPerIdea.max
          ? [...draft.topics, slug]
          : draft.topics,
    });
  const addTag = () => {
    const tag = normalizeTag(tagInput);
    if (tag && !draft.tags.includes(tag) && draft.tags.length < LIMITS.tagsPerIdea.max)
      patch({ tags: [...draft.tags, tag] });
    setTagInput("");
  };
  const onTagKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    } else if (event.key === "Backspace" && !tagInput && draft.tags.length) {
      patch({ tags: draft.tags.slice(0, -1) });
    }
  };

  const written = IDEA_SECTIONS.filter((k) => draft.sections[k]?.trim()).length;
  const checks = [
    { label: "A title", done: draft.title.trim().length >= LIMITS.ideaTitle.min },
    { label: "A short summary", done: draft.summary.trim().length >= LIMITS.ideaSummary.min },
    { label: "At least one topic", done: draft.topics.length >= 1 },
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(draft);
  };

  return (
    <form onSubmit={submit} className={styles.editor}>
      <div className={styles.main}>
        <section className={styles.step}>
          <p className={styles.stepLabel}>
            <span>01</span> The possibility
          </p>
          <Field
            label="What possibility do you want humanity to remember?"
            error={errors.title}
            counter={`${draft.title.length} / ${LIMITS.ideaTitle.max}`}
          >
            {(p) => (
              <input
                {...p}
                className={controlLarge}
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Name the idea"
                minLength={LIMITS.ideaTitle.min}
                maxLength={LIMITS.ideaTitle.max}
                required
              />
            )}
          </Field>
          <Field
            label="In two or three sentences"
            hint="What is it, and why might it matter? This is what people see in lists."
            error={errors.summary}
            counter={`${draft.summary.length} / ${LIMITS.ideaSummary.max}`}
          >
            {(p) => (
              <textarea
                {...p}
                className={control}
                value={draft.summary}
                onChange={(e) => patch({ summary: e.target.value })}
                minLength={LIMITS.ideaSummary.min}
                maxLength={LIMITS.ideaSummary.max}
                required
                rows={3}
              />
            )}
          </Field>
        </section>

        <section className={styles.step}>
          <p className={styles.stepLabel}>
            <span>02</span> Where it belongs
          </p>
          <div className={styles.fieldBlock}>
            <p className={styles.label}>
              Topics <span>1–{LIMITS.topicsPerIdea.max}; the first is primary</span>
            </p>
            <div className={styles.chips} role="group" aria-label="Topics">
              {topics.data?.map((t) => {
                const index = draft.topics.indexOf(t.slug);
                return (
                  <Chip key={t.id} pressed={index >= 0} onClick={() => toggleTopic(t.slug)}>
                    {index >= 0 && <Check aria-hidden />}
                    {t.name}
                    {index === 0 && <span className={styles.primary}>primary</span>}
                  </Chip>
                );
              })}
            </div>
            {errors.topics && <p className={styles.error}>{errors.topics}</p>}
          </div>
          <div className={styles.fieldBlock}>
            <label className={styles.label} htmlFor="tag-input">
              Tags <span>optional · press Enter to add</span>
            </label>
            <div className={styles.tags}>
              {draft.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  #{tag}
                  <button
                    type="button"
                    onClick={() => patch({ tags: draft.tags.filter((t) => t !== tag) })}
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                id="tag-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKey}
                onBlur={addTag}
                placeholder={draft.tags.length ? "" : "e.g. water, microplastics"}
                maxLength={LIMITS.tag.max}
              />
            </div>
          </div>
        </section>

        <section className={styles.step}>
          <p className={styles.stepLabel}>
            <span>03</span> Develop it <em>every part is optional; speculation is allowed</em>
          </p>
          <div className={styles.sections}>
            {IDEA_SECTIONS.map((key) => {
              const info = IDEA_SECTION_INFO[key];
              const open = openSections.has(key);
              const value = draft.sections[key] ?? "";
              return (
                <div key={key} className={cx(styles.section, open && styles.sectionOpen)}>
                  <button
                    type="button"
                    className={styles.sectionToggle}
                    aria-expanded={open}
                    onClick={() =>
                      setOpenSections(
                        (s) => new Set(s.has(key) ? [...s].filter((k) => k !== key) : [...s, key]),
                      )
                    }
                  >
                    <span>
                      <strong>{info.label}</strong>
                      {/* The overview's prompt is the title's; show what the section is for instead. */}
                      <span>{key === "overview" ? info.description : info.prompt}</span>
                    </span>
                    {value.trim() ? (
                      <Check className={styles.done} aria-label="Written" />
                    ) : (
                      <ChevronDown aria-hidden />
                    )}
                  </button>
                  {open && (
                    <textarea
                      className={control}
                      value={value}
                      onChange={(e) => setSection(key, e.target.value)}
                      aria-label={info.label}
                      placeholder={info.description}
                      maxLength={LIMITS.section.max}
                      rows={7}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className={styles.hint}>
            Sections support Markdown: **bold**, *italic*, lists, [links](https://…).
          </p>
        </section>
      </div>

      <aside className={styles.side}>
        <div className={styles.sideCard}>
          <p className="eyebrow">Required</p>
          <ul className={styles.checks} role="list">
            {checks.map((c) => (
              <li key={c.label} className={cx(c.done && styles.checkDone)}>
                <Check aria-hidden /> {c.label}
              </li>
            ))}
          </ul>
          <p className={styles.progress}>
            {written} of {IDEA_SECTIONS.length} sections developed
          </p>
          {aside}
          {footer}
          <FormError error={error && !Object.keys(errors).length ? error : null} />
          <Button
            type="submit"
            variant="primary"
            block
            loading={pending}
            disabled={!checks.every((c) => c.done)}
          >
            {submitLabel}
          </Button>
        </div>
      </aside>
    </form>
  );
}

/** Field errors from the API, with revision paths (`content.title`) mapped to field names. */
function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  return Object.fromEntries(
    Object.entries(error.fieldErrors).map(([path, message]) => [
      path.replace(/^content\./, "").split(".")[0]!,
      message,
    ]),
  );
}

function restore(key: string | undefined): IdeaDraft | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IdeaDraft>;
    return {
      ...emptyDraft,
      ...parsed,
      sections: { ...parsed.sections },
      topics: parsed.topics ?? [],
      tags: parsed.tags ?? [],
    };
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
