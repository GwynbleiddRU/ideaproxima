import { useNavigate } from "@tanstack/react-router";
import { useProposeIdea } from "@/api/ideas";
import { PageHeader } from "@/components/PageHeader";
import { clearDraft, emptyDraft, IdeaEditor } from "./IdeaEditor";
import styles from "./editor-page.module.scss";

const DRAFT_KEY = "ip-draft-new-idea";

export function NewIdeaPage() {
  const navigate = useNavigate();
  const propose = useProposeIdea();
  return (
    <div className="container">
      <title>Propose an idea · ideaproxima</title>
      <PageHeader
        eyebrow="Propose a possibility"
        title="Write it down before it is lost"
        lede="An idea does not need to be feasible, proven or popular to deserve preservation. Start with a title and a summary; anyone can help develop the rest."
      />
      <IdeaEditor
        initial={emptyDraft}
        draftKey={DRAFT_KEY}
        submitLabel="Add to the archive"
        pending={propose.isPending}
        error={propose.error}
        aside={
          <p className={styles.note}>
            You become the idea's first steward. Your draft is kept in this browser until you publish.
          </p>
        }
        onSubmit={(draft) =>
          propose.mutate(draft, {
            onSuccess: (idea) => {
              clearDraft(DRAFT_KEY);
              void navigate({ to: "/ideas/$idea", params: { idea: idea.slug } });
            },
          })
        }
      />
    </div>
  );
}
