import { useMessage } from "@/locales/react";
import { useNavigate } from "@tanstack/react-router";
import { useProposeIdea } from "@/api/ideas";
import { PageHeader } from "@/components/PageHeader";
import { clearDraft, emptyDraft, IdeaEditor } from "./IdeaEditor";
import styles from "./editor-page.module.scss";

const DRAFT_KEY = "ip-draft-new-idea";

export function NewIdeaPage() {
  const t = useMessage();
  const navigate = useNavigate();
  const propose = useProposeIdea();
  return (
    <div className="container">
      <title>{t("common.pageTitle", { title: t("nav.propose") })}</title>
      <PageHeader
        eyebrow={t("editor.new.proposeAPossibility")}
        title={t("editor.new.title")}
        lede={t("editor.new.lede")}
      />
      <IdeaEditor
        initial={emptyDraft}
        draftKey={DRAFT_KEY}
        submitLabel={t("editor.new.addToTheArchive")}
        pending={propose.isPending}
        error={propose.error}
        aside={<p className={styles.note}>{t("editor.new.draftHelp")}</p>}
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
