import { formatNumber } from "@/lib/format";
import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, CircleCheck, CircleDashed, X } from "lucide-react";
import {
  IDEA_SECTION_INFO,
  IDEA_SECTIONS,
  LIMITS,
  normalizeTag,
  type IdeaSectionKey,
} from "@ideaproxima/domain";
import { useTopicsQueryOptions } from "@/api/catalog";
import { isApiError } from "@/api/http";
import { StageBadge } from "@/components/Stage";
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
  const t = useMessage();
  const [draft, setDraft] = useState<IdeaDraft>(() => restore(draftKey) ?? initial);
  const topics = useQuery(useTopicsQueryOptions());
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
  const topicNames = new Map(topics.data?.map((t) => [t.slug, t.name]));
  const checks = [
    {
      label: "editor.aTitle" as const,
      missing: "editor.requirement.aTitle" as const,
      done: draft.title.trim().length >= LIMITS.ideaTitle.min,
    },
    {
      label: "editor.aShortSummary" as const,
      missing: "editor.requirement.aShortSummary" as const,
      done: draft.summary.trim().length >= LIMITS.ideaSummary.min,
    },
    {
      label: "editor.atLeastOneTopic" as const,
      missing: "editor.requirement.atLeastOneTopic" as const,
      done: draft.topics.length >= 1,
    },
  ];
  const missing = checks.find((c) => !c.done)?.missing;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(draft);
  };

  return (
    <form onSubmit={submit} className={styles.editor}>
      <div className={styles.main}>
        <section className={styles.step}>
          <p className={styles.stepLabel}>
            <span>01</span> {t("editor.thePossibility")}
          </p>
          <Field
            label={t("editor.titleLabel")}
            error={errors.title}
            counter={t("common.counter", { count: draft.title.length, total: LIMITS.ideaTitle.max })}
          >
            {(p) => (
              <input
                {...p}
                className={controlLarge}
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder={t("editor.nameTheIdea")}
                minLength={LIMITS.ideaTitle.min}
                maxLength={LIMITS.ideaTitle.max}
                required
              />
            )}
          </Field>
          <Field
            label={t("editor.summaryLabel")}
            hint={t("editor.summaryHint")}
            error={errors.summary}
            counter={t("common.counter", { count: draft.summary.length, total: LIMITS.ideaSummary.max })}
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
            <span>02</span> {t("editor.whereItBelongs")}
          </p>
          <div className={styles.fieldBlock}>
            <p className={styles.label}>
              <LocalizedText
                id="editor.topicSelection"
                values={{ min: LIMITS.topicsPerIdea.min, max: LIMITS.topicsPerIdea.max }}
                components={{ 0: <span /> }}
              />
            </p>
            <div className={styles.chips} role="group" aria-label={t("nav.topics")}>
              {topics.data?.map((topic) => {
                const index = draft.topics.indexOf(topic.slug);
                return (
                  <Chip
                    key={topic.id}
                    pressed={index >= 0}
                    onClick={() => toggleTopic(topic.slug)}
                    title={index === 0 ? t("editor.primaryTopic") : undefined}
                  >
                    {index >= 0 && (
                      <span className={styles.order} aria-hidden>
                        {formatNumber(index + 1)}
                      </span>
                    )}
                    {topic.name}
                    {index === 0 && <span className="visually-hidden">{t("editor.primary")}</span>}
                  </Chip>
                );
              })}
            </div>
            {errors.topics && <p className={styles.error}>{errors.topics}</p>}
          </div>
          <div className={styles.fieldBlock}>
            <label className={styles.label} htmlFor="tag-input">
              {t("editor.tags")} <span>{t("editor.tagsHint")}</span>
            </label>
            <div className={styles.tags}>
              {draft.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  #{tag}
                  <button
                    type="button"
                    onClick={() => patch({ tags: draft.tags.filter((t) => t !== tag) })}
                    aria-label={t("editor.removeTag", { tag })}
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
                placeholder={draft.tags.length ? "" : t("editor.tagsExample")}
                maxLength={LIMITS.tag.max}
              />
            </div>
          </div>
        </section>

        <section className={styles.step}>
          <p className={styles.stepLabel}>
            <span>03</span> {t("editor.developIt")} <em>{t("editor.sectionsHint")}</em>
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
                    <span className={cx(styles.state, value.trim() && styles.stateDone)} aria-hidden>
                      {value.trim() && <Check />}
                    </span>
                    <span className={styles.sectionText}>
                      <strong>{vocabularyField("sections", key, "label", info.label)}</strong>
                      {/* What the section is for; its prompt (often the label as a question) is the placeholder. */}
                      <span>{vocabularyField("sections", key, "description", info.description)}</span>
                    </span>
                    <span className={styles.sectionGo}>
                      {value.trim() ? t("editor.written") : t("editor.write")}
                      <ChevronDown className={cx(open && styles.chevronOpen)} aria-hidden />
                    </span>
                  </button>
                  {open && (
                    <textarea
                      className={control}
                      value={value}
                      onChange={(e) => setSection(key, e.target.value)}
                      aria-label={vocabularyField("sections", key, "label", info.label)}
                      // The overview's prompt is the title's question; ask for the detail instead.
                      placeholder={
                        key === "overview"
                          ? t("editor.overviewPlaceholder")
                          : vocabularyField("sections", key, "prompt", info.prompt)
                      }
                      maxLength={LIMITS.section.max}
                      rows={7}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className={styles.hint}>{t("editor.markdownHint")}</p>
        </section>
      </div>

      <aside className={styles.side}>
        <p className="eyebrow">{t("editor.previewHeading")}</p>
        <PreviewCard draft={draft} topicNames={topicNames} />
        <div className={styles.sideCard}>
          <ul className={styles.checks} role="list">
            {checks.map((c) => (
              <li key={c.label} className={cx(c.done && styles.checkDone)}>
                {c.done ? <CircleCheck aria-hidden /> : <CircleDashed aria-hidden />} {t(c.label)}
                <span className="visually-hidden">
                  {t("editor.requirementStatus", { done: c.done ? "yes" : "no" })}
                </span>
              </li>
            ))}
            <li className={cx(written > 0 && styles.checkDone)}>
              {written > 0 ? <CircleCheck aria-hidden /> : <CircleDashed aria-hidden />}
              <span>
                <LocalizedText
                  id="editor.sectionProgress"
                  values={{ count: written, total: IDEA_SECTIONS.length }}
                  components={{ 0: <b />, 1: <span className={styles.optional} /> }}
                />
              </span>
            </li>
          </ul>
          {aside}
          {footer}
          <FormError error={error && !Object.keys(errors).length ? error : null} />
          <Button
            type="submit"
            variant="primary"
            block
            retryError={error}
            loading={pending}
            disabled={!!missing}
          >
            {submitLabel}
          </Button>
          {missing && <p className={styles.missing}>{t(missing)}</p>}
        </div>
      </aside>
    </form>
  );
}

/** The idea as a list card will show it — a small reward for a clear title and summary. */
function PreviewCard({ draft, topicNames }: { draft: IdeaDraft; topicNames: Map<string, string> }) {
  const t = useMessage();
  return (
    <div className={styles.preview} aria-label={t("editor.previewLabel")} role="img">
      <div className={styles.previewTop}>
        <span className={styles.previewTopics}>
          {draft.topics.slice(0, 2).map((slug) => (
            <span key={slug}>{topicNames.get(slug) ?? slug}</span>
          ))}
        </span>
        <StageBadge stage="imagined" />
      </div>
      <p className={cx(styles.previewTitle, !draft.title.trim() && styles.placeholder)}>
        {draft.title.trim() || t("editor.yourTitle")}
      </p>
      <p className={cx(styles.previewSummary, !draft.summary.trim() && styles.placeholder)}>
        {draft.summary.trim() || t("editor.previewSummary")}
      </p>
    </div>
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
