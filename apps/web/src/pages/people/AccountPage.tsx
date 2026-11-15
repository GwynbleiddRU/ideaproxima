import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { PersonDto } from "@ideaproxima/contracts";
import { CAPACITIES, CAPACITY_INFO, LIMITS, type Capacity } from "@ideaproxima/domain";
import { catalogQueries } from "@/api/catalog";
import { isApiError } from "@/api/http";
import {
  peopleQueries,
  useChangePassword,
  useDeclareExpertise,
  useRevokeExpertise,
  useUpdateProfile,
} from "@/api/people";
import { useLogout, useSession } from "@/api/session";
import forms from "@/components/forms.module.scss";
import { PageHeader, SectionHeading } from "@/components/PageHeader";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { control, Field } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import styles from "./people.module.scss";

export function AccountPage() {
  const { me, email } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <div className="container">
      <title>Account · ideaproxima</title>
      <PageHeader
        eyebrow="Account"
        title="Your account"
        lede={`Signed in as @${me.handle}${email ? ` (${email})` : ""}. Your profile is public; your email is not.`}
        actions={
          <Button
            onClick={() => logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/" }) })}
            loading={logout.isPending}
          >
            Sign out
          </Button>
        }
      />
      <div className={styles.account}>
        <ProfileForm me={me} />
        <ExpertiseForm handle={me.handle} />
        <PasswordForm />
      </div>
    </div>
  );
}

function ProfileForm({ me }: { me: PersonDto }) {
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
      <SectionHeading eyebrow="Public" title="Profile" />
      <form onSubmit={submit} className={forms.form}>
        <div className={forms.row}>
          <Field label="Display name" error={errors.displayName}>
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
          <Field label="Affiliation" optional>
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
        <Field label="About you" optional counter={`${bio.length} / ${LIMITS.bio.max}`}>
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
          <p className={styles.label}>How you can help advance ideas</p>
          <div className={styles.chips}>
            {CAPACITIES.map((c) => (
              <Chip
                key={c}
                pressed={capacities.includes(c)}
                onClick={() => toggle(c)}
                title={CAPACITY_INFO[c].description}
              >
                {CAPACITY_INFO[c].label}
              </Chip>
            ))}
          </div>
        </div>
        <FormError error={update.error && !Object.keys(errors).length ? update.error : null} />
        <div className={forms.actions}>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}

function ExpertiseForm({ handle }: { handle: string }) {
  const profile = useQuery(peopleQueries.profile(handle));
  const topics = useQuery(catalogQueries.topics());
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
      <SectionHeading eyebrow="Domains" title="Expertise" />
      <p className={styles.muted}>Self-declared until verified by a moderator. Shown on your profile.</p>
      <ul className={styles.expertise} role="list">
        {profile.data?.expertise.map((e) => (
          <li key={e.topic.id}>
            {e.topic.name}
            <Badge tone={e.basis === "verified" ? "success" : "neutral"}>
              {e.basis === "verified" ? "Verified" : "Self-declared"}
            </Badge>
            <Button
              variant="quiet"
              size="sm"
              icon={<X />}
              onClick={() => revoke.mutate(e.topic.slug)}
              aria-label={`Remove ${e.topic.name}`}
            />
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className={forms.form}>
        <div className={forms.row}>
          <Field label="Topic">
            {(p) => (
              <select
                {...p}
                className={control}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              >
                <option value="">Choose a topic</option>
                {topics.data?.map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Basis" optional hint="Degree, role, years of practice…">
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
          <Button type="submit" loading={declare.isPending}>
            Declare expertise
          </Button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm() {
  const change = useChangePassword();
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
      <SectionHeading eyebrow="Security" title="Password" />
      <form onSubmit={submit} className={forms.form}>
        <div className={forms.row}>
          <Field label="Current password">
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
            label="New password"
            hint={`At least ${LIMITS.password.min} characters.`}
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
          <Button type="submit" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}
