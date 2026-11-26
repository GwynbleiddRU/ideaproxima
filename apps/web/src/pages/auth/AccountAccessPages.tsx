import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LIMITS } from "@ideaproxima/domain";
import { http, isApiError } from "@/api/http";
import { keys } from "@/api/keys";
import { useSession } from "@/api/session";
import { useMessage } from "@/locales/react";
import { Button, ButtonLink } from "@/ui/Button";
import { Field, control } from "@/ui/Field";
import { FormError } from "@/ui/Feedback";
import forms from "@/components/forms.module.scss";
import { AuthLayout } from "./AuthPage";

export function ForgotPasswordPage() {
  const t = useMessage();
  const [email, setEmail] = useState("");
  const send = useMutation({
    mutationFn: () => http.post("/auth/password-reset/request", { email }),
    meta: { inlineErrors: true },
  });
  if (send.isSuccess)
    return (
      <AuthLayout title={t("auth.checkMail")} lede={t("auth.resetSent")}>
        <Button onClick={() => send.reset()}>{t("auth.tryReset")}</Button>
      </AuthLayout>
    );
  return (
    <AuthLayout title={t("auth.forgot")} lede={t("auth.forgotLede")}>
      <form
        className={forms.form}
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <Field label={t("auth.emailAddress")}>
          {(props) => (
            <input
              {...props}
              className={control}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <FormError error={send.error} />
        <Button type="submit" variant="primary" size="lg" loading={send.isPending} retryError={send.error}>
          {t("auth.sendReset")}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ChangeEmailPage() {
  const t = useMessage();
  const [newEmail, setEmail] = useState("");
  const [currentPassword, setPassword] = useState("");
  const send = useMutation({
    mutationFn: () => http.post("/me/email", { newEmail, currentPassword }),
    meta: { inlineErrors: true },
    onSuccess: () => setPassword(""),
  });
  if (send.isSuccess)
    return (
      <AuthLayout title={t("auth.changeSent")} lede={t("auth.changeSentLede")}>
        <Link to="/account" className="link">
          {t("nav.settings")}
        </Link>
      </AuthLayout>
    );
  return (
    <AuthLayout title={t("auth.change")} lede={t("auth.changeLede")}>
      <form
        className={forms.form}
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <Field label={t("auth.newEmail")}>
          {(props) => (
            <input
              {...props}
              className={control}
              type="email"
              autoComplete="email"
              required
              value={newEmail}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label={t("auth.currentPassword")}>
          {(props) => (
            <input
              {...props}
              className={control}
              type="password"
              autoComplete="current-password"
              maxLength={LIMITS.password.max}
              required
              value={currentPassword}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <FormError error={send.error} />
        <Button type="submit" variant="primary" size="lg" loading={send.isPending} retryError={send.error}>
          {t("auth.changeSubmit")}
        </Button>
      </form>
    </AuthLayout>
  );
}

const actions = {
  verify: {
    path: "/auth/verify-email",
    title: "auth.verify",
    lede: "auth.verifyLede",
    submit: "auth.verifySubmit",
    done: "auth.verified",
    doneLede: "auth.verifiedLede",
  },
  reset: {
    path: "/auth/password-reset/confirm",
    title: "auth.reset",
    lede: "auth.resetLede",
    submit: "auth.resetSubmit",
    done: "auth.resetDone",
    doneLede: "auth.resetDoneLede",
  },
  change: {
    path: "/auth/email-change/confirm",
    title: "auth.confirm",
    lede: "auth.confirmLede",
    submit: "auth.confirmSubmit",
    done: "auth.changed",
    doneLede: "auth.changedLede",
  },
} as const;

function ConfirmAccountAction({ action }: { action: keyof typeof actions }) {
  const [link, setLink] = useState(() => ({ token: window.location.hash.slice(1), visit: 0 }));
  useEffect(() => {
    const clearFragment = () =>
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    if (window.location.hash) clearFragment();
    // Opening another email in this tab can be a same-document fragment navigation.
    const openLink = () => {
      const token = window.location.hash.slice(1);
      if (!token) return;
      clearFragment();
      setLink((previous) => ({ token, visit: previous.visit + 1 }));
    };
    window.addEventListener("hashchange", openLink);
    return () => window.removeEventListener("hashchange", openLink);
  }, []);
  return <ConfirmationForm key={link.visit} action={action} token={link.token} />;
}

function ConfirmationForm({ action, token }: { action: keyof typeof actions; token: string }) {
  const t = useMessage();
  const { me } = useSession();
  const client = useQueryClient();
  const [newPassword, setPassword] = useState("");
  const copy = actions[action];
  const confirm = useMutation({
    mutationFn: () => http.post(copy.path, action === "reset" ? { token, newPassword } : { token }),
    meta: { inlineErrors: true },
    onSuccess: async () => {
      setPassword("");
      await client.invalidateQueries(action === "reset" ? {} : { queryKey: keys.me });
    },
  });
  const reason = isApiError(confirm.error)
    ? (confirm.error.details as { reason?: string })?.reason
    : undefined;
  const issue =
    !token || reason === "token_invalid"
      ? "auth.invalid"
      : reason === "token_used"
        ? "auth.used"
        : reason === "token_expired"
          ? "auth.expired"
          : null;
  const destination = me ? "/account" : "/sign-in";
  if (confirm.isSuccess)
    return (
      <AuthLayout title={t(copy.done)} lede={t(copy.doneLede)}>
        <ButtonLink variant="primary" to={destination}>
          {t(action === "reset" ? "auth.signIn" : "auth.continue")}
        </ButtonLink>
      </AuthLayout>
    );
  if (issue)
    return (
      <AuthLayout title={t(issue)} lede={t("auth.tryAgain")}>
        {action === "reset" ? (
          <ButtonLink to="/forgot-password">{t("auth.tryReset")}</ButtonLink>
        ) : (
          <ButtonLink to={destination}>{t(me ? "nav.settings" : "auth.signIn")}</ButtonLink>
        )}
      </AuthLayout>
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    confirm.mutate();
  };
  return (
    <AuthLayout title={t(copy.title)} lede={t(copy.lede)}>
      <form className={forms.form} onSubmit={submit}>
        {action === "reset" && (
          <Field label={t("auth.newPassword")} hint={t("auth.passwordHint", { count: LIMITS.password.min })}>
            {(props) => (
              <input
                {...props}
                className={control}
                type="password"
                autoComplete="new-password"
                required
                minLength={LIMITS.password.min}
                maxLength={LIMITS.password.max}
                value={newPassword}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        )}
        <FormError error={confirm.error} />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={confirm.isPending}
          retryError={confirm.error}
        >
          {t(copy.submit)}
        </Button>
      </form>
    </AuthLayout>
  );
}
export function VerifyEmailPage() {
  return <ConfirmAccountAction action="verify" />;
}
export function ResetPasswordPage() {
  return <ConfirmAccountAction action="reset" />;
}
export function ConfirmEmailChangePage() {
  return <ConfirmAccountAction action="change" />;
}
