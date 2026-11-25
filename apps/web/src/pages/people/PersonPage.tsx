import { vocabularyField } from "@/lib/vocabulary";
import { LocalizedText, useMessage } from "@/locales/react";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Settings } from "lucide-react";
import type { MessageId } from "@/locales/messages";
import type { ProfileDto } from "@ideaproxima/contracts";
import { CAPACITY_INFO, INVOLVEMENT_STATUS_INFO, PERSON_ROLES, type PersonRole } from "@ideaproxima/domain";
import { useTopicNames } from "@/api/catalog";
import { peopleQueries, useSetActive, useSetRole } from "@/api/people";
import { useSession } from "@/api/session";
import { ActivityFeed } from "@/components/ActivityFeed";
import { IdeaCard } from "@/components/IdeaCard";
import { TimeAgo } from "@/components/meta";
import { ReasonDialog } from "@/components/ReasonDialog";
import { formatDate, formatNumber } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { EmptyState, Skeleton } from "@/ui/Feedback";
import { InfoTip } from "@/ui/InfoTip";
import { Segmented } from "@/ui/Segmented";
import styles from "./people.module.scss";

const route = getRouteApi("/people/$handle");

const CONTRIBUTIONS = [
  { key: "ideasProposed", label: "person.contributions.ideasProposed" },
  { key: "revisionsAccepted", label: "person.contributions.revisionsAccepted" },
  { key: "claims", label: "person.contributions.claims" },
  { key: "evidence", label: "person.contributions.evidence" },
  { key: "arguments", label: "person.contributions.arguments" },
  { key: "evaluations", label: "person.contributions.evaluations" },
  { key: "comments", label: "person.contributions.comments" },
  { key: "initiatives", label: "person.contributions.initiatives" },
  { key: "usefulReceived", label: "person.contributions.usefulReceived" },
] as const satisfies ReadonlyArray<{ key: keyof ProfileDto["contributions"]; label: MessageId }>;

const personRoleLabel = {
  member: "person.role.member",
  moderator: "person.role.moderator",
  admin: "person.role.admin",
} as const;
const personRoleOption = {
  member: "person.roleOption.member",
  moderator: "person.roleOption.moderator",
  admin: "person.roleOption.admin",
} as const;

type Tab = "ideas" | "helping" | "activity";

/** A contributor's intellectual portfolio: what they proposed, contributed and are involved in. */
export function PersonPage() {
  const t = useMessage();
  const { handle } = route.useParams();
  const profile = useSuspenseQuery(peopleQueries.profile(handle)).data;
  const { person } = profile;
  const session = useSession();
  const isMe = session.me?.id === person.id;
  const topicNames = useTopicNames();
  const counts = CONTRIBUTIONS.filter(({ key }) => profile.contributions[key] > 0);
  const [tab, setTab] = useState<Tab>(
    profile.ideas.length || !profile.involvements.length ? "ideas" : "helping",
  );
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "ideas", label: t("person.ideas"), count: profile.ideas.length },
    { key: "helping", label: t("person.helpingWith"), count: profile.involvements.length },
    { key: "activity", label: t("nav.activity") },
  ];

  return (
    <div className="container">
      <title>{t("common.pageTitle", { title: person.displayName })}</title>
      <header className={styles.header}>
        <span className={styles.avatar}>
          <Avatar name={person.displayName} seed={person.handle} size={72} />
        </span>
        <h1 className={styles.name}>{person.displayName}</h1>
        <div className={styles.headerActions}>
          {isMe && (
            <ButtonLink to="/account" size="sm">
              <Settings /> {t("person.editProfile")}
            </ButtonLink>
          )}
          {!isMe && <ModerationControls handle={person.handle} role={person.role} active={person.active} />}
        </div>
        <p className={styles.handle}>
          @{person.handle}
          {person.affiliation && <> · {person.affiliation}</>}{" "}
          {t("person.joinedOn", { date: formatDate(person.createdAt) })}
          {person.role !== "member" && (
            <>
              {" "}
              <Badge tone="primary">{t(personRoleLabel[person.role])}</Badge>
            </>
          )}
          {!person.active && (
            <>
              {" "}
              <Badge tone="danger">{t("person.deactivated")}</Badge>
            </>
          )}
        </p>
        {person.bio && <p className={styles.bio}>{person.bio}</p>}
        {(person.capacities.length > 0 || profile.expertise.length > 0) && (
          <div className={styles.tags}>
            {person.capacities.length > 0 && (
              <p>
                <span className={styles.tagLabel}>{t("person.canHelpWith")}</span>
                {person.capacities.map((c) => (
                  <Badge key={c} tone="primary">
                    {vocabularyField("capacities", c, "label", CAPACITY_INFO[c].label)}
                  </Badge>
                ))}
              </p>
            )}
            {profile.expertise.length > 0 && (
              <p>
                <span className={styles.tagLabel}>{t("person.expertise")}</span>
                {profile.expertise.map((e) => (
                  <Link
                    key={e.topic.id}
                    to="/topics/$slug"
                    params={{ slug: e.topic.slug }}
                    className={styles.expertiseTag}
                  >
                    {topicNames?.get(e.topic.slug) ?? e.topic.name}
                    <span>{e.basis === "verified" ? t("person.verified") : t("person.selfDeclared")}</span>
                  </Link>
                ))}
              </p>
            )}
          </div>
        )}
      </header>

      <section className={styles.stats} aria-label={t("person.recordedContributions")}>
        {counts.length ? (
          <dl>
            {counts.map(({ key, label }) => (
              <div key={key}>
                <dt>{t(label, { count: profile.contributions[key] })}</dt>
                <dd>{formatNumber(profile.contributions[key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.muted}>{t("person.noContributionsRecordedYet")}</p>
        )}
        <p className={styles.statsNote}>
          {t("person.contributionsDescription")}{" "}
          <InfoTip label={t("person.aboutTheseNumbers")}>{t("person.contributionsHelp")}</InfoTip>
        </p>
      </section>

      <div className={styles.tabs} role="tablist" aria-label={t("person.profileSections")}>
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
            {t.count !== undefined && t.count > 0 && (
              <span className={styles.tabCount}>{formatNumber(t.count)}</span>
            )}
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
            <EmptyState compact title={t("person.noIdeasProposedYet")}>
              {isMe ? t("person.anIdeaDoesNot") : undefined}
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
                    <LocalizedText id="person.sinceDate" components={{ 0: <TimeAgo iso={i.since} /> }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title={t("person.notInvolvedInAny")} />
          ))}
        {tab === "activity" && <PersonActivity handle={person.handle} />}
      </div>
    </div>
  );
}

function PersonActivity({ handle }: { handle: string }) {
  const t = useMessage();
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
          {t("person.olderActivity")}
        </Button>
      )}
    </div>
  );
}

/** Moderators act on members; admins on anyone (and change roles). Every action is logged publicly. */
function ModerationControls({ handle, role, active }: { handle: string; role: PersonRole; active: boolean }) {
  const t = useMessage();
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
          label={t("person.role")}
          size="sm"
          value={role}
          onChange={(r) => setRole.mutate(r)}
          options={PERSON_ROLES.map((r) => ({ value: r, label: t(personRoleOption[r]) }))}
        />
      )}
      <Button size="sm" variant={active ? "danger" : "secondary"} onClick={() => setConfirming(true)}>
        {active ? t("person.deactivateAccount") : t("person.reactivateAccount")}
      </Button>
      <ReasonDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={active ? t("person.deactivateThisAccount") : t("person.reactivateThisAccount")}
        description={active ? t("person.deactivateHelp") : t("person.reactivateHelp")}
        confirmLabel={active ? t("person.deactivate") : t("person.reactivate")}
        danger={active}
        onConfirm={(reason) => setActive.mutateAsync({ active: !active, reason })}
      />
    </div>
  );
}
