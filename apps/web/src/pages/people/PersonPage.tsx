import { vocabularyField } from "@/lib/vocabulary";
import { useLocale } from "@/locales/react";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Settings } from "lucide-react";
import type { ProfileDto } from "@ideaproxima/contracts";
import { CAPACITY_INFO, INVOLVEMENT_STATUS_INFO, PERSON_ROLES, type PersonRole } from "@ideaproxima/domain";
import { peopleQueries, useSetActive, useSetRole } from "@/api/people";
import { useSession } from "@/api/session";
import { ActivityFeed } from "@/components/ActivityFeed";
import { IdeaCard } from "@/components/IdeaCard";
import { TimeAgo } from "@/components/meta";
import { ReasonDialog } from "@/components/ReasonDialog";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { EmptyState, Skeleton } from "@/ui/Feedback";
import { InfoTip } from "@/ui/InfoTip";
import { Segmented } from "@/ui/Segmented";
import styles from "./people.module.scss";

const route = getRouteApi("/people/$handle");

const CONTRIBUTIONS: { key: keyof ProfileDto["contributions"]; one: string; many: string }[] = [
  { key: "ideasProposed", one: "idea proposed", many: "ideas proposed" },
  { key: "revisionsAccepted", one: "revision accepted", many: "revisions accepted" },
  { key: "claims", one: "claim stated", many: "claims stated" },
  { key: "evidence", one: "piece of evidence", many: "pieces of evidence" },
  { key: "arguments", one: "argument", many: "arguments" },
  { key: "evaluations", one: "evaluation", many: "evaluations" },
  { key: "comments", one: "comment", many: "comments" },
  { key: "initiatives", one: "initiative recorded", many: "initiatives recorded" },
  { key: "usefulReceived", one: "time marked useful", many: "times marked useful" },
];

type Tab = "ideas" | "helping" | "activity";

/** A contributor's intellectual portfolio: what they proposed, contributed and are involved in. */
export function PersonPage() {
  useLocale();
  const { handle } = route.useParams();
  const profile = useSuspenseQuery(peopleQueries.profile(handle)).data;
  const { person } = profile;
  const session = useSession();
  const isMe = session.me?.id === person.id;
  const counts = CONTRIBUTIONS.filter(({ key }) => profile.contributions[key] > 0);
  const [tab, setTab] = useState<Tab>(
    profile.ideas.length || !profile.involvements.length ? "ideas" : "helping",
  );
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "ideas", label: "Ideas", count: profile.ideas.length },
    { key: "helping", label: "Helping with", count: profile.involvements.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div className="container">
      <title>{`${person.displayName} · ideaproxima`}</title>
      <header className={styles.header}>
        <span className={styles.avatar}>
          <Avatar name={person.displayName} seed={person.handle} size={72} />
        </span>
        <h1 className={styles.name}>{person.displayName}</h1>
        <div className={styles.headerActions}>
          {isMe && (
            <ButtonLink to="/account" size="sm">
              <Settings /> Edit profile
            </ButtonLink>
          )}
          {!isMe && <ModerationControls handle={person.handle} role={person.role} active={person.active} />}
        </div>
        <p className={styles.handle}>
          @{person.handle}
          {person.affiliation && <> · {person.affiliation}</>} · joined {formatDate(person.createdAt)}
          {person.role !== "member" && (
            <>
              {" "}
              <Badge tone="primary">{person.role}</Badge>
            </>
          )}
          {!person.active && (
            <>
              {" "}
              <Badge tone="danger">Deactivated</Badge>
            </>
          )}
        </p>
        {person.bio && <p className={styles.bio}>{person.bio}</p>}
        {(person.capacities.length > 0 || profile.expertise.length > 0) && (
          <div className={styles.tags}>
            {person.capacities.length > 0 && (
              <p>
                <span className={styles.tagLabel}>Can help with</span>
                {person.capacities.map((c) => (
                  <Badge key={c} tone="primary">
                    {vocabularyField("capacities", c, "label", CAPACITY_INFO[c].label)}
                  </Badge>
                ))}
              </p>
            )}
            {profile.expertise.length > 0 && (
              <p>
                <span className={styles.tagLabel}>Expertise</span>
                {profile.expertise.map((e) => (
                  <Link
                    key={e.topic.id}
                    to="/topics/$slug"
                    params={{ slug: e.topic.slug }}
                    className={styles.expertiseTag}
                  >
                    {e.topic.name}
                    <span>{e.basis === "verified" ? "verified" : "self-declared"}</span>
                  </Link>
                ))}
              </p>
            )}
          </div>
        )}
      </header>

      <section className={styles.stats} aria-label="Recorded contributions">
        {counts.length ? (
          <dl>
            {counts.map(({ key, one, many }) => (
              <div key={key}>
                <dt>{profile.contributions[key] === 1 ? one : many}</dt>
                <dd>{profile.contributions[key]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.muted}>No contributions recorded yet.</p>
        )}
        <p className={styles.statsNote}>
          Plain counts of what is in the record — not a measure of quality, influence or intelligence.
          <InfoTip label="About these numbers">
            Contribution influence (how strongly someone's evaluations count, per domain) will be computed
            from demonstrated judgment, and explained here when it exists.
          </InfoTip>
        </p>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Profile sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="profile-panel"
            className={styles.tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className={styles.tabCount}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div id="profile-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={styles.tabPanel}>
        {tab === "ideas" &&
          (profile.ideas.length ? (
            <div className={styles.ideas}>
              {profile.ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          ) : (
            <EmptyState compact title="No ideas proposed yet">
              {isMe ? "An idea does not need to be feasible, proven or popular to be kept." : undefined}
            </EmptyState>
          ))}
        {tab === "helping" &&
          (profile.involvements.length ? (
            <ul className={styles.involvements} role="list">
              {profile.involvements.map((i) => (
                <li key={`${i.idea.id}-${i.capacity}`}>
                  <Link to="/ideas/$idea/practice" params={{ idea: i.idea.slug }} className={styles.ideaLink}>
                    {i.idea.title}
                  </Link>
                  <Badge tone={i.status === "active" ? "success" : "primary"}>
                    {vocabularyField("capacities", i.capacity, "label", CAPACITY_INFO[i.capacity].label)}
                  </Badge>
                  <span className={styles.muted}>
                    {vocabularyField(
                      "involvementStatuses",
                      i.status,
                      "label",
                      INVOLVEMENT_STATUS_INFO[i.status].label,
                    )}{" "}
                    · since <TimeAgo iso={i.since} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Not involved in any idea yet" />
          ))}
        {tab === "activity" && <PersonActivity handle={person.handle} />}
      </div>
    </div>
  );
}

function PersonActivity({ handle }: { handle: string }) {
  const activity = useInfiniteQuery(peopleQueries.activity(handle));
  const entries = activity.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className={styles.activity}>
      {activity.isPending ? (
        <Skeleton lines={5} />
      ) : (
        <ActivityFeed entries={entries} showActor={false} byDay />
      )}
      {activity.hasNextPage && (
        <Button onClick={() => void activity.fetchNextPage()} loading={activity.isFetchingNextPage}>
          Older activity
        </Button>
      )}
    </div>
  );
}

/** Moderators act on members; admins on anyone (and change roles). Every action is logged publicly. */
function ModerationControls({ handle, role, active }: { handle: string; role: PersonRole; active: boolean }) {
  const { isModerator, isAdmin } = useSession();
  const setActive = useSetActive(handle);
  const setRole = useSetRole(handle);
  const [confirming, setConfirming] = useState(false);
  const canModerate = isAdmin || (isModerator && role === "member");
  if (!canModerate) return null;
  return (
    <div className={styles.moderation}>
      {isAdmin && (
        <Segmented<PersonRole>
          label="Role"
          size="sm"
          value={role}
          onChange={(r) => setRole.mutate(r)}
          options={PERSON_ROLES.map((r) => ({ value: r, label: r[0]!.toUpperCase() + r.slice(1) }))}
        />
      )}
      <Button size="sm" variant={active ? "danger" : "secondary"} onClick={() => setConfirming(true)}>
        {active ? "Deactivate account" : "Reactivate account"}
      </Button>
      <ReasonDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={active ? "Deactivate this account" : "Reactivate this account"}
        description={
          active
            ? "They will be signed out and unable to act. Their contributions stay, attributed. The reason is published."
            : "They will be able to sign in and contribute again."
        }
        confirmLabel={active ? "Deactivate" : "Reactivate"}
        danger={active}
        onConfirm={(reason) => setActive.mutateAsync({ active: !active, reason })}
      />
    </div>
  );
}
