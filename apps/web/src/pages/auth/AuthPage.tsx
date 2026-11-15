import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LIMITS } from "@ideaproxima/domain";
import { isApiError } from "@/api/http";
import { useLogin, useRegister, useSession } from "@/api/session";
import forms from "@/components/forms.module.scss";
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
    <AuthLayout
      title="Welcome back"
      lede="Sign in to contribute: take stances, evaluate, add evidence, propose ideas."
    >
      <form onSubmit={submit} className={forms.form}>
        <Field label="Email">
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
        <Field label="Password">
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
        <FormError error={login.error} />
        <Button type="submit" variant="primary" size="lg" block loading={login.isPending}>
          Sign in
        </Button>
      </form>
      <p className={styles.switch}>
        New here?{" "}
        <Link to="/join" search={{ redirect }} className="link">
          Create an account
        </Link>
      </p>
      {isLocal && (
        <p className={styles.demo}>
          Local demo data (after <code>npm run db:seed:demo</code>):{" "}
          <code>demo-mira@demo.ideaproxima.invalid</code> / <code>demo-password-123</code>
        </p>
      )}
    </AuthLayout>
  );
}

export function JoinPage() {
  const { me } = useSession();
  const { redirect } = useSearch({ from: "/join" });
  const register = useRegister();
  const [form, setForm] = useState({ displayName: "", handle: "", email: "", password: "" });
  const errors = isApiError(register.error) ? register.error.fieldErrors : {};
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    register.mutate(form);
  };

  if (me) return <BackToApp redirect={redirect} />;
  return (
    <AuthLayout
      title="Join the archive"
      lede="Your name and contributions are public and attributed. Your email is never shown."
    >
      <form onSubmit={submit} className={forms.form}>
        <Field label="Name" error={errors.displayName}>
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
        <Field
          label="Handle"
          hint="Lowercase letters, digits and hyphens. Appears in your profile address."
          error={errors.handle}
        >
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
        <Field label="Email" error={errors.email}>
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
        <Field label="Password" hint={`At least ${LIMITS.password.min} characters.`} error={errors.password}>
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
        <FormError error={register.error && !Object.keys(errors).length ? register.error : null} />
        <Button type="submit" variant="primary" size="lg" block loading={register.isPending}>
          Create account
        </Button>
      </form>
      <p className={styles.switch}>
        Already have an account?{" "}
        <Link to="/sign-in" search={{ redirect }} className="link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

function AuthLayout({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <title>{`${title} · ideaproxima`}</title>
      <div className={styles.card}>
        <Logo size={36} />
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{lede}</p>
        {children}
      </div>
    </div>
  );
}
