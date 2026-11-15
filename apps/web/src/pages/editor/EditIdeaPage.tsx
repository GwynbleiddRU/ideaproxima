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
            toast.success("Your proposed revision is waiting for a steward's decision.");
            void navigate({ to: "/ideas/$idea/history", params: { idea: idea.slug } });
          } else {
            toast.success(`Revision ${revision.number} published.`);
            void navigate({ to: "/ideas/$idea", params: { idea: idea.slug } });
          }
        },
      },
    );

  return (
    <div className="container">
      <title>{`Edit: ${idea.title} · ideaproxima`}</title>
      <PageHeader
        eyebrow={publishes ? "Edit" : "Suggest an edit"}
        title={idea.title}
        lede={
          publishes
            ? "As a steward you publish directly. A new revision is created; the previous one stays in the history."
            : "Your changes become a proposed revision. The idea's stewards will accept or decline it, and you are credited either way."
        }
      />
      {conflict && (
        <div className={styles.conflict} role="alert">
          <p>
            <strong>Someone published a newer revision while you were editing.</strong> Your text is kept
            below. Review the{" "}
            <Link to="/ideas/$idea/history" params={{ idea: idea.slug }} target="_blank" className="link">
              latest changes
            </Link>
            , then submit again on top of them.
          </p>
          <Button
            size="sm"
            onClick={() => {
              submit.reset();
              void queryClient.invalidateQueries({ queryKey: keys.idea(idea.slug) });
            }}
          >
            Use the latest revision as the base
          </Button>
        </div>
      )}
      {/* Not keyed by revision: after a rebase the editor keeps the author's text; only the base moves. */}
      <IdeaEditor
        initial={initial}
        submitLabel={publishes ? "Publish revision" : "Propose revision"}
        pending={submit.isPending}
        error={conflict ? null : submit.error}
        aside={<p className={styles.note}>Editing revision {idea.revision.number}.</p>}
        footer={
          <Field
            label="What changed and why"
            hint="Shown in the history."
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
