import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties, type FormEvent } from "react";
import { MessageSquarePlus, MessagesSquare } from "lucide-react";
import type { CommentDto, IdeaDetail } from "@ideaproxima/contracts";
import {
  ARGUMENT_STANCE_INFO,
  COMMENT_KINDS,
  LIMITS,
  type ArgumentStance,
  type CommentKind,
} from "@ideaproxima/domain";
import { discussionQueries, usePostComment } from "@/api/discussion";
import { isApiError } from "@/api/http";
import { keys } from "@/api/keys";
import { knowledgeQueries } from "@/api/knowledge";
import { useSession } from "@/api/session";
import { useAuthGate } from "@/components/auth";
import { ArgumentCard, ArgumentComposer, UsefulButton } from "@/components/knowledge/Arguments";
import { PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { SectionHeading } from "@/components/PageHeader";
import { argumentStanceColor } from "@/components/status";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { control } from "@/ui/Field";
import { EmptyState, FormError, Skeleton } from "@/ui/Feedback";
import { Segmented } from "@/ui/Segmented";
import { useIdea } from "./use-idea";
import styles from "./DiscussionTab.module.scss";
import tabs from "./tabs.module.scss";

/**
 * Two kinds of conversation, kept apart: structured arguments (for, against, qualifying — each assessable for
 * strength) and an open comment thread for questions and suggestions.
 */
export function DiscussionTab() {
  const idea = useIdea();
  return (
    <div className={tabs.tab}>
      <ArgumentsSection idea={idea} />
      <CommentsSection idea={idea} />
    </div>
  );
}

const COLUMNS: { stance: ArgumentStance; title: string; empty: string; invite: string }[] = [
  { stance: "supports", title: "For it", empty: "No argument for it yet.", invite: "Argue for it" },
  {
    stance: "opposes",
    title: "Against it",
    empty: "No argument against it yet.",
    invite: "Argue against it",
  },
];

/**
 * Arguments for and against side by side, so the balance of the debate is visible at a glance; qualifications
 * (accepting the idea with conditions) follow below both columns.
 */
function ArgumentsSection({ idea }: { idea: IdeaDetail }) {
  const gate = useAuthGate();
  const args = useQuery(knowledgeQueries.ideaArguments(idea.slug));
  const [composing, setComposing] = useState<ArgumentStance | null>(null);
  const invalidate = [keys.ideaPart(idea.slug, "arguments"), keys.idea(idea.slug)];
  const all = args.data ?? [];
  const qualifying = all.filter((a) => a.stance === "qualifies");
  const compose = (stance: ArgumentStance) => gate(() => setComposing(stance));

  return (
    <section className={tabs.group} aria-labelledby="arguments-title">
      <SectionHeading
        id="arguments-title"
        eyebrow="Structured debate"
        title="Arguments"
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<MessageSquarePlus />}
            onClick={() => compose("supports")}
          >
            Make an argument
          </Button>
        }
      />
      {composing && (
        <div className={tabs.panel}>
          <ArgumentComposer
            key={composing}
            target={{ kind: "idea", id: idea.id }}
            invalidate={invalidate}
            initialStance={composing}
            onDone={() => setComposing(null)}
          />
        </div>
      )}
      {args.isPending ? (
        <Skeleton lines={5} />
      ) : (
        <>
          <div className={styles.debate}>
            {COLUMNS.map((col) => {
              const list = all.filter((a) => a.stance === col.stance);
              return (
                <div
                  key={col.stance}
                  className={styles.column}
                  style={{ "--stance": argumentStanceColor(col.stance) } as CSSProperties}
                >
                  <h3 className={styles.columnTitle}>
                    {col.title} <span>{list.length}</span>
                  </h3>
                  {list.length ? (
                    list.map((a) => <ArgumentCard key={a.id} argument={a} invalidate={invalidate} />)
                  ) : (
                    <div className={styles.emptyColumn}>
                      <p>{col.empty}</p>
                      <Button variant="quiet" size="sm" onClick={() => compose(col.stance)}>
                        {col.invite}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {qualifying.length > 0 && (
            <div className={styles.qualifications}>
              <h3 className={styles.columnTitle}>
                {ARGUMENT_STANCE_INFO.qualifies.label} <span>{qualifying.length}</span>
              </h3>
              {qualifying.map((a) => (
                <ArgumentCard key={a.id} argument={a} invalidate={invalidate} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CommentsSection({ idea }: { idea: IdeaDetail }) {
  const comments = useInfiniteQuery(discussionQueries.comments(idea.slug));
  const all = comments.data?.pages.flatMap((p) => p.items) ?? [];
  const children = new Map<string | null, CommentDto[]>();
  for (const c of all) {
    const parent = c.parentId && all.some((p) => p.id === c.parentId) ? c.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), c]);
  }

  return (
    <section className={tabs.group}>
      <SectionHeading
        eyebrow="Conversation"
        title={<>Comments {all.length > 0 && <span className={styles.titleCount}>{all.length}</span>}</>}
      />
      <CollapsedComposer idea={idea} />
      {comments.isPending ? (
        <Skeleton lines={4} />
      ) : all.length ? (
        <ol className={styles.thread} role="list">
          {(children.get(null) ?? []).map((c) => (
            <CommentItem key={c.id} comment={c} replies={children} idea={idea} depth={0} />
          ))}
        </ol>
      ) : (
        <EmptyState compact icon={<MessagesSquare />} title="No comments yet">
          Ask a question, suggest an improvement, or point to related work.
        </EmptyState>
      )}
      {comments.hasNextPage && (
        <Button onClick={() => void comments.fetchNextPage()} loading={comments.isFetchingNextPage}>
          Load more comments
        </Button>
      )}
    </section>
  );
}

const KIND_LABEL: Record<CommentKind, string> = {
  comment: "Comment",
  question: "Question",
  suggestion: "Suggestion",
};

/** A one-line invitation that opens the full composer, so an empty thread does not start with a big form. */
function CollapsedComposer({ idea }: { idea: IdeaDetail }) {
  const gate = useAuthGate();
  const { me } = useSession();
  const [open, setOpen] = useState(false);
  if (open) return <CommentComposer idea={idea} autoFocus onDone={() => setOpen(false)} />;
  return (
    <button type="button" className={styles.invite} onClick={() => gate(() => setOpen(true))}>
      {me && <Avatar name={me.displayName} seed={me.handle} size={28} />}
      <span>Add a comment, question or suggestion…</span>
    </button>
  );
}

function CommentComposer({
  idea,
  parentId,
  onDone,
  autoFocus,
}: {
  idea: IdeaDetail;
  parentId?: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const gate = useAuthGate();
  const post = usePostComment(idea.slug);
  const [kind, setKind] = useState<CommentKind>("comment");
  const [body, setBody] = useState("");
  const errors = isApiError(post.error) ? post.error.fieldErrors : {};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    gate(() =>
      post.mutate(
        { kind, body: body.trim(), parentId },
        {
          onSuccess: () => {
            setBody("");
            onDone?.();
          },
        },
      ),
    );
  };

  return (
    <form onSubmit={submit} className={styles.composer}>
      {!parentId && (
        <Segmented
          label="Kind of comment"
          size="sm"
          value={kind}
          onChange={setKind}
          options={COMMENT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
        />
      )}
      <textarea
        className={control}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Share a thought, a question or a suggestion…"}
        aria-label={parentId ? "Reply" : "Comment"}
        aria-invalid={errors.body ? true : undefined}
        minLength={LIMITS.commentBody.min}
        maxLength={LIMITS.commentBody.max}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        required
      />
      <FormError error={post.error} />
      <div className={styles.composerActions}>
        {onDone && (
          <Button size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" variant="primary" loading={post.isPending} disabled={!body.trim()}>
          {parentId ? "Reply" : "Post"}
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  replies,
  idea,
  depth,
}: {
  comment: CommentDto;
  replies: Map<string | null, CommentDto[]>;
  idea: IdeaDetail;
  depth: number;
}) {
  const gate = useAuthGate();
  const [replying, setReplying] = useState(false);
  const children = replies.get(comment.id) ?? [];
  return (
    <li className={styles.comment}>
      <div className={styles.commentHead}>
        <PersonLink person={comment.author} avatar size={24} />
        {comment.kind !== "comment" && (
          <Badge tone={comment.kind === "question" ? "primary" : "neutral"}>{KIND_LABEL[comment.kind]}</Badge>
        )}
        <TimeAgo iso={comment.createdAt} />
      </div>
      {comment.hidden ? (
        <p className={styles.hidden}>Hidden by moderation. The reason is in the public moderation log.</p>
      ) : (
        <p className={styles.body}>{comment.body}</p>
      )}
      <div className={styles.commentActions}>
        {depth < 4 && (
          <Button variant="quiet" size="sm" onClick={() => gate(() => setReplying(true))}>
            Reply
          </Button>
        )}
        <UsefulButton
          kind="comment"
          id={comment.id}
          count={comment.derived.usefulCount}
          invalidate={[keys.ideaPart(idea.slug, "comments")]}
        />
        <ModerateButton kind="comment" id={comment.id} hidden={comment.hidden} />
      </div>
      {replying && <CommentComposer idea={idea} parentId={comment.id} onDone={() => setReplying(false)} />}
      {children.length > 0 && (
        <ol className={styles.replies} role="list">
          {children.map((c) => (
            <CommentItem key={c.id} comment={c} replies={replies} idea={idea} depth={depth + 1} />
          ))}
        </ol>
      )}
    </li>
  );
}
