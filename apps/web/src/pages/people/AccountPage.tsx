import { vocabularyField } from "@/lib/vocabulary";
import { useMessage } from "@/locales/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { PersonDto } from "@ideaproxima/contracts";
import { CAPACITIES, CAPACITY_INFO, LIMITS, type Capacity } from "@ideaproxima/domain";
import { useTopicsQueryOptions } from "@/api/catalog";
import { http, isApiError } from "@/api/http";
import {
  peopleQueries,
  useChangePassword,
  useDeclareExpertise,
  useRevokeExpertise,
  useUpdateProfile,
} from "@/api/people";
import { useLogout, useSession } from "@/api/session";
import forms from "@/components/forms.module.scss";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PageHeader, SectionHeading } from "@/components/PageHeader";
import { Badge } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { control, Field } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import styles from "./people.module.scss";
import { AccountSecurity } from "./AccountSecurity";

export function AccountPage() {
  const t = useMessage();
  const { me, email, account } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <div className="container">
      <title>{t("common.pageTitle", { title: t("account.account") })}</title>
      <PageHeader
        eyebrow={t("account.account")}
        title={t("nav.account")}
        lede={
          email
            ? t("account.signedInEmail", { handle: me.handle, email })
            : t("account.signedIn", { handle: me.handle })
        }
        actions={
          <Button
            onClick={() => logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/" }) })}
            loading={logout.isPending}
          >
            {t("nav.signOut")}
          </Button>
        }
      />
      <div className={styles.account}>
        <section className={styles.panel}>
          <LanguageSwitcher settings />
        </section>
        <AccountEmail />
        {account && <AccountSecurity account={account} />}
        <ProfileForm me={me} />
        <ExpertiseForm handle={me.handle} />
        <PasswordForm personId={me.id} />
      </div>
    </div>
  );
}

function AccountEmail() {
  const t = useMessage();
  const { email, emailVerified } = useSession();
  const resend = useMutation({
    mutationFn: () => http.post("/auth/verify-email/resend"),
    meta: { inlineErrors: true },
  });
  return (
    <section className={styles.panel}>
      <SectionHeading eyebrow={t("account.security")} title={t("auth.emailAddress")} />
      <p>
        <bdi>{email}</bdi>
      </p>
      <p className={styles.muted} role="status">
        {t(emailVerified ? "auth.verified" : resend.isSuccess ? "auth.resendDone" : "auth.unverified")}
      </p>
      <FormError error={resend.error} />
      <div className={forms.actions}>
        {!emailVerified && (
          <Button loading={resend.isPending} retryError={resend.error} onClick={() => resend.mutate()}>
            {t("auth.resend")}
          </Button>
        )}
        <ButtonLink to="/change-email">{t("auth.change")}</ButtonLink>
      </div>
    </section>
  );
}

function ProfileForm({ me }: { me: PersonDto }) {
  const t = useMessage();
  const update = useUpdateProfile(me.handle);
  const [displayName, setDisplayName] = useState(me.displayName);
  const [affiliation, setAffiliation] = useState(me.affiliation);
  const [bio, setBio] = useState(me.bio);
  const [capacities, setCapacities] = useState<Capacity[]>(me.capacities);
  const errors = isApiError(update.error) ? update.error.fieldErrors : {};
  const toggle = (c: Capacity) =>
    setCapacities((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({
      displayName: displayName.trim(),
      affiliation: affiliation.trim(),
      bio: bio.trim(),
      capacities,
    });
  };
  return (
    <section className={styles.panel}>
      <SectionHeading eyebrow={t("account.public")} title={t("account.profile")} />
      <form onSubmit={submit} className={forms.form}>
        <div className={forms.row}>
          <Field label={t("account.displayName")} error={errors.displayName}>
            {(p) => (
              <input
                {...p}
                className={control}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                minLength={LIMITS.displayName.min}
                maxLength={LIMITS.displayName.max}
                required
              />
            )}
          </Field>
          <Field label={t("account.affiliation")} optional>
            {(p) => (
              <input
                {...p}
                className={control}
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                maxLength={200}
              />
            )}
          </Field>
        </div>
        <Field
          label={t("account.aboutYou")}
          optional
          counter={t("common.counter", { count: bio.length, total: LIMITS.bio.max })}
        >
          {(p) => (
            <textarea
              {...p}
              className={control}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={LIMITS.bio.max}
              rows={4}
            />
          )}
        </Field>
        <div className={styles.capacityField}>
          <p className={styles.label}>{t("account.howYouCanHelp")}</p>
          <div className={styles.chips}>
            {CAPACITIES.map((c) => (
              <Chip
                key={c}
                pressed={capacities.includes(c)}
                onClick={() => toggle(c)}
                title={vocabularyField("capacities", c, "description", CAPACITY_INFO[c].description)}
              >
                {vocabularyField("capacities", c, "label", CAPACITY_INFO[c].label)}
              </Chip>
            ))}
          </div>
        </div>
        <FormError error={update.error && !Object.keys(errors).length ? update.error : null} />
        <div className={forms.actions}>
          <Button type="submit" variant="primary" retryError={update.error} loading={update.isPending}>
            {t("account.saveProfile")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ExpertiseForm({ handle }: { handle: string }) {
  const t = useMessage();
  const profile = useQuery(peopleQueries.profile(handle));
  const topics = useQuery(useTopicsQueryOptions());
  const topicNames = new Map(topics.data?.map((topic) => [topic.slug, topic.name]));
  const declare = useDeclareExpertise(handle);
  const revoke = useRevokeExpertise(handle);
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    declare.mutate(
      { topic, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setTopic("");
          setNote("");
        },
      },
    );
  };
  return (
    <section className={styles.panel}>
      <SectionHeading eyebrow={t("account.domains")} title={t("account.expertise")} />
      <p className={styles.muted}>{t("account.expertiseDescription")}</p>
      <ul className={styles.expertise} role="list">
        {profile.data?.expertise.map((e) => {
          const name = topicNames.get(e.topic.slug) ?? e.topic.name;
          return (
            <li key={e.topic.id}>
              {name}
              <Badge tone={e.basis === "verified" ? "success" : "neutral"}>
                {e.basis === "verified" ? t("account.verifiedBadge") : t("account.selfDeclared")}
              </Badge>
              <Button
                variant="quiet"
                size="sm"
                icon={<X />}
                onClick={() => revoke.mutate(e.topic.slug)}
                aria-label={t("account.removeExpertise", { topic: name })}
              />
            </li>
          );
        })}
      </ul>
      <form onSubmit={submit} className={forms.form}>
        <div className={forms.row}>
          <Field label={t("explore.topic")}>
            {(p) => (
              <select
                {...p}
                className={control}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              >
                <option value="">{t("account.chooseATopic")}</option>
                {topics.data?.map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("account.basis")} optional hint={t("account.expertiseBasisHint")}>
            {(p) => (
              <input
                {...p}
                className={control}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            )}
          </Field>
        </div>
        <FormError error={declare.error} />
        <div className={forms.actions}>
          <Button type="submit" retryError={declare.error} loading={declare.isPending}>
            {t("account.declareExpertise")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm({ personId }: { personId: string }) {
  const t = useMessage();
  const change = useChangePassword(personId);
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const errors = isApiError(change.error) ? change.error.fieldErrors : {};
  const submit = (event: FormEvent) => {
    event.preventDefault();
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrent("");
          setNew("");
        },
      },
    );
  };
  return (
    <section className={styles.panel}>
      <SectionHeading eyebrow={t("account.security")} title={t("auth.password")} />
      <form onSubmit={submit} className={forms.form}>
        <div className={forms.row}>
          <Field label={t("account.currentPassword")}>
            {(p) => (
              <input
                {...p}
                className={control}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            )}
          </Field>
          <Field
            label={t("account.newPassword")}
            hint={t("auth.passwordHint", { count: LIMITS.password.min })}
            error={errors.newPassword}
          >
            {(p) => (
              <input
                {...p}
                className={control}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNew(e.target.value)}
                minLength={LIMITS.password.min}
                maxLength={LIMITS.password.max}
                required
              />
            )}
          </Field>
        </div>
        <FormError error={change.error && !errors.newPassword ? change.error : null} />
        <div className={forms.actions}>
          <Button type="submit" retryError={change.error} loading={change.isPending}>
            {t("account.changePassword")}
          </Button>
        </div>
      </form>
    </section>
  );
}
