import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { ProfileDto } from "@ideaproxima/contracts";
import { CAPACITY_INFO, INVOLVEMENT_STATUS_INFO, PERSON_ROLES, type PersonRole } from "@ideaproxima/domain";
import { peopleQueries, useSetActive, useSetRole } from "@/api/people";
import { useSession } from "@/api/session";
import { ActivityItem, ActivityList } from "@/components/ActivityItem";
import { IdeaCard } from "@/components/IdeaCard";
import { SectionHeading } from "@/components/PageHeader";
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

const CONTRIBUTIONS: { key: keyof ProfileDto["contributions"]; label: string }[] = [
  { key: "ideasProposed", label: "Ideas proposed" },
  { key: "revisionsAccepted", label: "Revisions accepted" },
  { key: "claims", label: "Claims stated" },
  { key: "evidence", label: "Evidence contributed" },
  { key: "arguments", label: "Arguments" },
  { key: "evaluations", label: "Evaluations" },
  { key: "initiatives", label: "Initiatives recorded" },
  { key: "usefulReceived", label: "Marked useful by others" },
];

/** A contributor's intellectual portfolio: what they proposed, contributed and are involved in. */
export function PersonPage() {
  const { handle } = route.useParams();
  const profile = useSuspenseQuery(peopleQueries.profile(handle)).data;
  const { person } = profile;
  const session = useSession();
  const isMe = session.me?.id === person.id;

  return (
    <div className="container">
      <title>{`${person.displayName} · ideaproxima`}</title>
      <header className={styles.header}>
        <Avatar name={person.displayName} seed={person.handle} size={80} />
        <div className={styles.identity}>
          <h1 className={styles.name}>{person.displayName}</h1>
          <p className={styles.handle}>
            @{person.handle} · joined {formatDate(person.createdAt)}
          </p>
          <div className={styles.badges}>
            {person.role !== "member" && <Badge tone="primary">{person.role}</Badge>}
            {!person.active && <Badge tone="danger">Deactivated</Badge>}
            {person.affiliation && <Badge tone="outline">{person.affiliation}</Badge>}
          </div>
          {person.bio && <p className={styles.bio}>{person.bio}</p>}
          {person.capacities.length > 0 && (
            <p className={styles.capacities}>
              Can contribute through{" "}
              {person.capacities.map((c) => CAPACITY_INFO[c].label.toLowerCase()).join(", ")}.
            </p>
          )}
        </div>
        <div className={styles.headerActions}>
          {isMe && (
            <ButtonLink to="/account" size="sm">
              Edit profile
            </ButtonLink>
          )}
          {!isMe && <ModerationControls handle={person.handle} role={person.role} active={person.active} />}
        </div>
      </header>

      <section className={styles.section}>
        <SectionHeading
          eyebrow="Recorded contributions"
          title="Contributions"
          action={
            <InfoTip label="About these numbers">
              Plain counts of recorded contributions — not a measure of quality or intelligence. Contribution
              influence (how strongly someone's evaluations count, per domain) will be computed from
              demonstrated judgment, and explained here when it exists.
            </InfoTip>
          }
        />
        <dl className={styles.counts}>
          {CONTRIBUTIONS.map(({ key, label }) => (
            <div key={key}>
              <dd>{profile.contributions[key]}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {profile.expertise.length > 0 && (
        <section className={styles.section}>
          <SectionHeading eyebrow="Domains" title="Expertise" />
          <ul className={styles.expertise} role="list">
            {profile.expertise.map((e) => (
              <li key={e.topic.id}>
                <Link to="/topics/$slug" params={{ slug: e.topic.slug }} className="link">
                  {e.topic.name}
                </Link>
                <Badge tone={e.basis === "verified" ? "success" : "neutral"}>
                  {e.basis === "verified" ? "Verified" : "Self-declared"}
                </Badge>
                {e.note && <span className={styles.muted}>{e.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <SectionHeading eyebrow="Proposed" title={`Ideas (${profile.ideas.length})`} />
        {profile.ideas.length ? (
          <div className={styles.ideas}>
            {profile.ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        ) : (
          <EmptyState compact title="No ideas proposed yet" />
        )}
      </section>

      {profile.involvements.length > 0 && (
        <section className={styles.section}>
          <SectionHeading eyebrow="Working on" title="Involvements" />
          <ul className={styles.involvements} role="list">
            {profile.involvements.map((i) => (
              <li key={`${i.idea.id}-${i.capacity}`}>
                <Link to="/ideas/$idea/practice" params={{ idea: i.idea.slug }} className={styles.ideaLink}>
                  {i.idea.title}
                </Link>
                <Badge tone="primary">{CAPACITY_INFO[i.capacity].label}</Badge>
                <span className={styles.muted}>{INVOLVEMENT_STATUS_INFO[i.status].label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PersonActivity handle={person.handle} />
    </div>
  );
}

function PersonActivity({ handle }: { handle: string }) {
  const activity = useInfiniteQuery(peopleQueries.activity(handle));
  const entries = activity.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className={styles.section}>
      <SectionHeading eyebrow="In the ledger" title="Recent activity" />
      {activity.isPending ? (
        <Skeleton lines={5} />
      ) : (
        <ActivityList>
          {entries.map((e) => (
            <ActivityItem key={e.id} entry={e} />
          ))}
        </ActivityList>
      )}
      {activity.hasNextPage && (
        <Button onClick={() => void activity.fetchNextPage()} loading={activity.isFetchingNextPage}>
          Older activity
        </Button>
      )}
    </section>
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
