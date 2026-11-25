import { LocalizedText, useMessage } from "@/locales/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { isApiError } from "@/api/http";
import { ideaQueries, useSubmitRevision } from "@/api/ideas";
import { keys } from "@/api/keys";
import { useSession } from "@/api/session";
import { PageHeader } from "@/components/PageHeader";
import { LIMITS } from "@ideaproxima/domain";
import { toast } from "@/ui/Toast";
import { Button } from "@/ui/Button";
import { control, Field } from "@/ui/Field";
import { IdeaEditor, type IdeaDraft } from "./IdeaEditor";
import styles from "./editor-page.module.scss";

const route = getRouteApi("/ideas/$idea/edit");

/**
 * Edit an idea's narrative. Stewards (and moderators) publish a new revision directly; everyone else proposes
 * one for the stewards to decide. Either way the previous text is never lost.
 */
export function EditIdeaPage() {
  const t = useMessage();
  const { idea: ref } = route.useParams();
  const idea = useSuspenseQuery(ideaQueries.detail(ref)).data;
  const { isModerator } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submit = useSubmitRevision(idea.slug);
  const [changeNote, setChangeNote] = useState("");
  const publishes = !!idea.viewer?.isSteward || isModerator;
  const conflict = isApiError(submit.error, 409);

  const initial: IdeaDraft = {
    title: idea.title,
    summary: idea.summary,
    sections: { ...idea.sections },
    topics: idea.topics.map((t) => t.slug),
    tags: [...idea.tags],
  };

  const onSubmit = (content: IdeaDraft) =>
    submit.mutate(
      { baseRevisionId: idea.revision.id, content, changeNote: changeNote.trim(), intent: "auto" },
      {
        onSuccess: (revision) => {
          if (revision.status === "proposed") {
            toast.success(t("toast.revisionProposed"));
            void navigate({ to: "/ideas/$idea/history", params: { idea: idea.slug } });
          } else {
            toast.success(t("toast.revisionPublished", { number: revision.number }));
            void navigate({ to: "/ideas/$idea", params: { idea: idea.slug } });
          }
        },
      },
    );

  return (
    <div className="container">
      <title>{t("common.pageTitle", { title: t("editor.edit.title", { idea: idea.title }) })}</title>
      <PageHeader
        eyebrow={publishes ? t("editor.edit.edit") : t("editor.edit.suggestAnEdit")}
        title={idea.title}
        lede={publishes ? t("editor.edit.publishLede") : t("editor.edit.proposalLede")}
      />
      {conflict && (
        <div className={styles.conflict} role="alert">
          <p>
            <LocalizedText
              id="editor.edit.conflict"
              components={{
                0: <strong />,
                1: (
                  <Link
                    to="/ideas/$idea/history"
                    params={{ idea: idea.slug }}
                    target="_blank"
                    className="link"
                  />
                ),
              }}
            />
          </p>
          <Button
            size="sm"
            onClick={() => {
              submit.reset();
              void queryClient.invalidateQueries({ queryKey: keys.idea(idea.slug) });
            }}
          >
            {t("editor.edit.rebase")}
          </Button>
        </div>
      )}
      {/* Not keyed by revision: after a rebase the editor keeps the author's text; only the base moves. */}
      <IdeaEditor
        initial={initial}
        submitLabel={publishes ? t("editor.edit.publishRevision") : t("editor.edit.proposeRevision")}
        pending={submit.isPending}
        error={conflict ? null : submit.error}
        aside={
          <p className={styles.note}>{t("editor.edit.baseRevision", { number: idea.revision.number })}</p>
        }
        footer={
          <Field
            label={t("editor.edit.changeNote")}
            hint={t("editor.edit.changeNoteHint")}
            error={isApiError(submit.error) ? submit.error.fieldErrors.changeNote : undefined}
          >
            {(p) => (
              <textarea
                {...p}
                className={control}
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                minLength={3}
                maxLength={LIMITS.changeNote.max}
                required
                rows={3}
              />
            )}
          </Field>
        }
        onSubmit={onSubmit}
      />
    </div>
  );
}
