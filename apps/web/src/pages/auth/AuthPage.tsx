import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LIMITS } from "@ideaproxima/domain";
import { errorMessage, isApiError } from "@/api/http";
import { useLogin, useRegister, useSession } from "@/api/session";
import forms from "@/components/forms.module.scss";
import { LocalizedText, useMessage } from "@/locales/react";
import { activeLocale } from "@/locales/runtime";
import { Button } from "@/ui/Button";
import { control, Field } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import { Logo } from "@/ui/Logo";
import styles from "./AuthPage.module.scss";

const isLocal =
  typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

/**
 * Once a session exists (just signed in, or already signed in), go back where the person came from. The
 * redirect is validated as a same-site path by the route's search parser.
 */
function BackToApp({ redirect }: { redirect?: string }) {
  const router = useRouter();
  useEffect(() => router.history.replace(redirect ?? "/"), [router, redirect]);
  return null;
}

export function SignInPage() {
  const t = useMessage();
  const { me } = useSession();
  const { redirect } = useSearch({ from: "/sign-in" });
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  if (me) return <BackToApp redirect={redirect} />;
  return (
    <AuthLayout title={t("auth.welcome")} lede={t("auth.signInLede")}>
      <form onSubmit={submit} className={forms.form}>
        <Field label={t("auth.email")}>
          {(p) => (
            <input
              {...p}
              className={control}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          )}
        </Field>
        <Field label={t("auth.password")}>
          {(p) => (
            <input
              {...p}
              className={control}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>
        <AuthError error={login.error} />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          retryError={login.error}
          loading={login.isPending}
        >
          {t("auth.signIn")}
        </Button>
      </form>
      <p className={styles.switch}>
        <LocalizedText
          id="auth.newHere"
          components={{ 0: <Link to="/join" search={{ redirect }} className="link" /> }}
        />
      </p>
      {isLocal && (
        <p className={styles.demo}>
          <LocalizedText
            id="auth.demo"
            components={{ 0: <code dir="ltr" />, 1: <code dir="ltr" />, 2: <code dir="ltr" /> }}
          />
        </p>
      )}
    </AuthLayout>
  );
}

export function JoinPage() {
  const t = useMessage();
  const { me } = useSession();
  const { redirect } = useSearch({ from: "/join" });
  const register = useRegister();
  const [form, setForm] = useState({ displayName: "", handle: "", email: "", password: "" });
  const errors = isApiError(register.error) ? register.error.fieldErrors : {};
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    register.mutate({ ...form, locale: activeLocale() });
  };

  if (me) return <BackToApp redirect={redirect} />;
  return (
    <AuthLayout title={t("auth.join")} lede={t("auth.joinLede")}>
      <form onSubmit={submit} className={forms.form}>
        <Field label={t("auth.name")} error={errors.displayName}>
          {(p) => (
            <input
              {...p}
              className={control}
              autoComplete="name"
              value={form.displayName}
              onChange={set("displayName")}
              minLength={LIMITS.displayName.min}
              maxLength={LIMITS.displayName.max}
              required
              autoFocus
            />
          )}
        </Field>
        <Field label={t("auth.handle")} hint={t("auth.handleHint")} error={errors.handle}>
          {(p) => (
            <input
              {...p}
              className={control}
              autoComplete="username"
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })}
              pattern="[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?"
              minLength={LIMITS.handle.min}
              maxLength={LIMITS.handle.max}
              required
            />
          )}
        </Field>
        <Field label={t("auth.email")} error={errors.email}>
          {(p) => (
            <input
              {...p}
              className={control}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set("email")}
              required
            />
          )}
        </Field>
        <Field
          label={t("auth.password")}
          hint={t("auth.passwordHint", { count: LIMITS.password.min })}
          error={errors.password}
        >
          {(p) => (
            <input
              {...p}
              className={control}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              minLength={LIMITS.password.min}
              maxLength={LIMITS.password.max}
              required
            />
          )}
        </Field>
        <AuthError error={register.error && !Object.keys(errors).length ? register.error : null} />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          retryError={register.error}
          loading={register.isPending}
        >
          {t("auth.create")}
        </Button>
      </form>
      <p className={styles.switch}>
        <LocalizedText
          id="auth.haveAccount"
          components={{ 0: <Link to="/sign-in" search={{ redirect }} className="link" /> }}
        />
      </p>
    </AuthLayout>
  );
}

function AuthError({ error }: { error: unknown }) {
  const t = useMessage();
  return (
    <FormError
      error={error}
      describe={(cause) => {
        if (!isApiError(cause)) return t("auth.network");
        return cause.status === 429 ? errorMessage(cause) : cause.message;
      }}
    />
  );
}

function AuthLayout({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  const t = useMessage();
  return (
    <div className={styles.page}>
      <title>{t("auth.title", { title })}</title>
      <div className={styles.card}>
        <Logo size={36} />
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{lede}</p>
        {children}
      </div>
    </div>
  );
}
