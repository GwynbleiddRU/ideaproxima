import { vocabularyField } from "@/lib/vocabulary";
import { useMessage } from "@/locales/react";
import { formatList, formatNumber } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeftRight, Network } from "lucide-react";
import type { IdeaDetail, IdeaRelationView } from "@ideaproxima/contracts";
import {
  LIMITS,
  MAX_GRAPH_DEPTH,
  RELATION_TYPE_INFO,
  RELATION_TYPES,
  type GraphDirection,
  type RelationType,
} from "@ideaproxima/domain";
import { graphQueries, useProposeRelation, useRetractRelation } from "@/api/graph";
import { useTopicNames } from "@/api/catalog";
import { ideaQueries } from "@/api/ideas";
import { useAuthGate } from "@/components/auth";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import forms from "@/components/forms.module.scss";
import { MetaLine, PersonLink, TimeAgo } from "@/components/meta";
import { SectionHeading } from "@/components/PageHeader";
import { RatingMeter } from "@/components/Ratings";
import { RelationGraph } from "@/components/RelationGraph";
import { StageBadge } from "@/components/Stage";
import { useDebounced } from "@/lib/hooks";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { control, Field, Fieldset } from "@/ui/Field";
import { EmptyState, FormError, Skeleton } from "@/ui/Feedback";
import { Segmented } from "@/ui/Segmented";
import { useIdea, usePermissions } from "./use-idea";
import styles from "./ConnectionsTab.module.scss";
import tabs from "./tabs.module.scss";

function relationPhrase(relation: IdeaRelationView) {
  const field = relation.direction === "incoming" ? "inverse" : "forward";
  return vocabularyField("relationTypes", relation.type, field, relation.phrase);
}

/**
 * How this idea connects to others. For a scientist, the killer views: what must exist first (upstream) and
 * what it would unlock once realised (downstream). Every connection is typed; there is no vague "related".
 */
export function ConnectionsTab() {
  const t = useMessage();
  const idea = useIdea();
  const gate = useAuthGate();
  const search = useSearch({ from: "/ideas/$idea/connections" });
  const navigate = useNavigate({ from: "/ideas/$idea/connections" });
  const direction = search.direction ?? "both";
  const depth = search.depth ?? 2;
  const graph = useQuery(graphQueries.graph(idea.slug, direction, depth));
  const relations = useQuery(graphQueries.relations(idea.slug));
  const [connecting, setConnecting] = useState(false);

  const byPhrase = new Map<string, IdeaRelationView[]>();
  for (const r of relations.data ?? []) byPhrase.set(r.phrase, [...(byPhrase.get(r.phrase) ?? []), r]);

  return (
    <div className={`${tabs.tab} ${tabs.wide}`}>
      <SectionHeading
        eyebrow={t("idea.connections.title")}
        title={t("idea.tabs.connections")}
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<ArrowLeftRight />}
            onClick={() => gate(() => setConnecting(true))}
          >
            {t("idea.connections.connect")}
          </Button>
        }
      />
      <p className={tabs.lede}>{t("idea.connections.directionsHelp")}</p>
      {/* The view changes in place: keep the reader where they are (the router resets scroll by default). */}
      <div className={tabs.toolbar}>
        <Segmented<GraphDirection>
          label={t("idea.connections.filterDirection")}
          value={direction}
          onChange={(d) =>
            void navigate({
              search: (prev) => ({ ...prev, direction: d === "both" ? undefined : d }),
              replace: true,
              resetScroll: false,
            })
          }
          options={[
            { value: "both", label: t("idea.connections.both") },
            { value: "upstream", label: t("idea.connections.upstream") },
            { value: "downstream", label: t("idea.connections.downstream") },
          ]}
        />
        <Segmented<number>
          label={t("idea.connections.depth")}
          size="sm"
          value={depth}
          onChange={(d) =>
            void navigate({
              search: (prev) => ({ ...prev, depth: d === 2 ? undefined : d }),
              replace: true,
              resetScroll: false,
            })
          }
          options={Array.from({ length: MAX_GRAPH_DEPTH }, (_, i) => ({
            value: i + 1,
            label: t("idea.connections.steps", { count: i + 1 }),
          }))}
        />
      </div>
      {graph.isPending ? (
        <Skeleton lines={6} />
      ) : graph.data && graph.data.nodes.length > 1 ? (
        <RelationGraph graph={graph.data} showEnables={direction !== "upstream"} />
      ) : (
        <EmptyState icon={<Network />} title={t("idea.connections.emptyTitle")}>
          {t("idea.connections.empty")}
        </EmptyState>
      )}

      {byPhrase.size > 0 && (
        <div className={styles.relations}>
          {[...byPhrase].map(([phrase, list]) => (
            <section key={phrase} className={tabs.group}>
              <h3 className={tabs.groupTitle}>
                {t("idea.connections.group", { relation: relationPhrase(list[0]!) })}{" "}
                <span>{formatNumber(list.length)}</span>
              </h3>
              <ul className={tabs.list} role="list">
                {list.map((r) => (
                  <RelationRow key={r.id} relation={r} idea={idea} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <ConnectDialog open={connecting} onClose={() => setConnecting(false)} idea={idea} />
    </div>
  );
}

function RelationRow({ relation, idea }: { relation: IdeaRelationView; idea: IdeaDetail }) {
  const t = useMessage();
  const can = usePermissions(idea);
  const gate = useAuthGate();
  const retract = useRetractRelation(idea.slug);
  const [assessing, setAssessing] = useState(false);
  return (
    <li className={styles.relation}>
      <div className={styles.relationMain}>
        <Link to="/ideas/$idea" params={{ idea: relation.other.slug }} className={styles.other}>
          {relation.other.title}
        </Link>
        <StageBadge stage={relation.other.stage} />
      </div>
      {relation.rationale && <p className={styles.rationale}>{relation.rationale}</p>}
      <div className={styles.relationFoot}>
        <MetaLine>
          <span>
            <PersonLink person={relation.proposedBy} />
          </span>
          <TimeAgo iso={relation.createdAt} />
        </MetaLine>
        <div className={styles.validity}>
          <RatingMeter dimension="validity" summary={relation.derived.validity} size="sm" />
        </div>
        <div className={styles.actions}>
          <Button variant="quiet" size="sm" onClick={() => gate(() => setAssessing(true))}>
            {t("idea.connections.accurate")}
          </Button>
          {can.canCurate(relation.proposedBy.id) && (
            <Button
              variant="quiet"
              size="sm"
              retryError={retract.error}
              loading={retract.isPending}
              onClick={() => retract.mutate(relation.id)}
            >
              {t("idea.connections.retract")}
            </Button>
          )}
        </div>
      </div>
      <EvaluateDialog
        open={assessing}
        onClose={() => setAssessing(false)}
        target={{ kind: "relation", id: relation.id }}
        subject={t("idea.connections.sentence", {
          from: idea.title,
          relation: relationPhrase(relation),
          to: relation.other.title,
        })}
        invalidate={[["idea", idea.slug, "relations"]]}
      />
    </li>
  );
}

function ConnectDialog({ open, onClose, idea }: { open: boolean; onClose: () => void; idea: IdeaDetail }) {
  const t = useMessage();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t("idea.connections.connect")}
      description={t("idea.connections.describe")}
    >
      <ConnectForm idea={idea} onDone={onClose} />
    </Dialog>
  );
}

function ConnectForm({ idea, onDone }: { idea: IdeaDetail; onDone: () => void }) {
  const t = useMessage();
  const topicNames = useTopicNames();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const candidates = useQuery(ideaQueries.top("newest", 8, { q: q || undefined }));
  const [otherId, setOtherId] = useState("");
  const [type, setType] = useState<RelationType>("requires");
  const [reversed, setReversed] = useState(false);
  const [rationale, setRationale] = useState("");
  const propose = useProposeRelation(idea.slug);
  const other = candidates.data?.items.find((i) => i.id === otherId);
  const info = RELATION_TYPE_INFO[type];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const [from, to] = reversed && !info.symmetric ? [otherId, idea.id] : [idea.id, otherId];
    propose.mutate(
      { fromIdeaId: from, toIdeaId: to, type, rationale: rationale.trim() || undefined },
      { onSuccess: onDone },
    );
  };

  const relation = vocabularyField("relationTypes", type, "forward", info.forward);
  const reverse = reversed && !info.symmetric;
  const preview =
    other &&
    t("idea.connections.sentence", {
      from: reverse ? other.title : idea.title,
      relation,
      to: reverse ? idea.title : other.title,
    });

  return (
    <form onSubmit={submit} className={forms.form}>
      <Fieldset legend={t("idea.connections.otherIdea")}>
        <input
          className={control}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("idea.connections.searchPlaceholder")}
          aria-label={t("idea.connections.search")}
        />
        <div className={forms.choices}>
          {(candidates.data?.items ?? [])
            .filter((i) => i.id !== idea.id)
            .map((i) => (
              <label key={i.id} className={forms.choice}>
                <input
                  type="radio"
                  name="other"
                  checked={otherId === i.id}
                  onChange={() => setOtherId(i.id)}
                  required
                />
                <strong>{i.title}</strong>
                <span>{formatList(i.topics.map((topic) => topicNames?.get(topic.slug) ?? topic.name))}</span>
              </label>
            ))}
        </div>
      </Fieldset>
      <Fieldset legend={t("idea.connections.type")}>
        <div className={forms.choices}>
          {RELATION_TYPES.map((t) => (
            <label key={t} className={forms.choice}>
              <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} />
              <strong>{vocabularyField("relationTypes", t, "label", RELATION_TYPE_INFO[t].label)}</strong>
              <span>
                {vocabularyField("relationTypes", t, "description", RELATION_TYPE_INFO[t].description)}
              </span>
            </label>
          ))}
        </div>
      </Fieldset>
      {!info.symmetric && (
        <Segmented
          label={t("idea.connections.direction")}
          value={reversed ? "reverse" : "forward"}
          onChange={(v) => setReversed(v === "reverse")}
          options={[
            {
              value: "forward",
              label: t("idea.connections.forward", { relation }),
            },
            {
              value: "reverse",
              label: t("idea.connections.reverse", { relation }),
            },
          ]}
        />
      )}
      {preview && <p className={styles.preview}>{preview}</p>}
      <Field label={t("idea.connections.why")} optional hint={t("idea.connections.rationaleHint")}>
        {(p) => (
          <textarea
            {...p}
            className={control}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            maxLength={LIMITS.rationale.max}
            rows={2}
          />
        )}
      </Field>
      <FormError error={propose.error} />
      <div className={forms.actions}>
        <Button onClick={onDone}>{t("common.cancel")}</Button>
        <Button
          type="submit"
          variant="primary"
          retryError={propose.error}
          loading={propose.isPending}
          disabled={!otherId}
        >
          {t("idea.connections.record")}
        </Button>
      </div>
    </form>
  );
}
