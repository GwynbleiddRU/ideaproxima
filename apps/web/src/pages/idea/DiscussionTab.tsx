import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { MessageSquarePlus, MessagesSquare } from "lucide-react";
import type { CommentDto, IdeaDetail } from "@ideaproxima/contracts";
import {
  ARGUMENT_STANCE_INFO,
  ARGUMENT_STANCES,
  COMMENT_KINDS,
  LIMITS,
  type ArgumentStance,
  type CommentKind,
} from "@ideaproxima/domain";
import { discussionQueries, usePostComment } from "@/api/discussion";
import { isApiError } from "@/api/http";
import { keys } from "@/api/keys";
import { knowledgeQueries } from "@/api/knowledge";
import { useAuthGate } from "@/components/auth";
import { ArgumentCard, ArgumentComposer, UsefulButton } from "@/components/knowledge/Arguments";
import { PersonLink, TimeAgo } from "@/components/meta";
import { ModerateButton } from "@/components/ModerateButton";
import { SectionHeading } from "@/components/PageHeader";
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

function ArgumentsSection({ idea }: { idea: IdeaDetail }) {
  const gate = useAuthGate();
  const args = useQuery(knowledgeQueries.ideaArguments(idea.slug));
  const [filter, setFilter] = useState<ArgumentStance | "all">("all");
  const [composing, setComposing] = useState(false);
  const invalidate = [keys.ideaPart(idea.slug, "arguments"), keys.idea(idea.slug)];
  const all = args.data ?? [];
  const shown = filter === "all" ? all : all.filter((a) => a.stance === filter);

  return (
    <section className={tabs.group}>
      <SectionHeading
        eyebrow="Structured debate"
        title="Arguments"
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<MessageSquarePlus />}
            onClick={() => gate(() => setComposing(true))}
          >
            Make an argument
          </Button>
        }
      />
      {composing && (
        <div className={tabs.panel}>
          <ArgumentComposer
            target={{ kind: "idea", id: idea.id }}
            invalidate={invalidate}
            onDone={() => setComposing(false)}
          />
        </div>
      )}
      {all.length > 0 && (
        <Segmented
          label="Filter arguments by stance"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${all.length}` },
            ...ARGUMENT_STANCES.map((s) => ({
              value: s,
              label: `${ARGUMENT_STANCE_INFO[s].label} ${all.filter((a) => a.stance === s).length}`,
            })),
          ]}
        />
      )}
      {args.isPending ? (
        <Skeleton lines={5} />
      ) : shown.length ? (
        <div className={tabs.stack}>
          {shown.map((a) => (
            <ArgumentCard key={a.id} argument={a} invalidate={invalidate} />
          ))}
        </div>
      ) : (
        <EmptyState compact title="No arguments yet">
          The strongest case against an idea is as valuable as the case for it.
        </EmptyState>
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
      <SectionHeading eyebrow="Conversation" title={`Comments${all.length ? ` (${all.length})` : ""}`} />
      <CommentComposer idea={idea} />
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

function CommentComposer({
  idea,
  parentId,
  onDone,
}: {
  idea: IdeaDetail;
  parentId?: string;
  onDone?: () => void;
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
