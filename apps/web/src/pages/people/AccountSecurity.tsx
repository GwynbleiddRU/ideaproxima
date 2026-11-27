import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor } from "lucide-react";
import type { MeResponse, SecurityEventPage, SessionPage } from "@ideaproxima/contracts";
import { http } from "@/api/http";
import { keys } from "@/api/keys";
import { TermsConfirmation } from "@/components/TermsConfirmation";
import { formatDateTime } from "@/lib/format";
import { useMessage } from "@/locales/react";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { FormError } from "@/ui/Feedback";
import styles from "./people.module.scss";

function useAccountList<T extends SessionPage | SecurityEventPage>(personId: string, resource: string) {
  return useInfiniteQuery({
    queryKey: [...keys.accountSecurity(personId), resource],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => http.get<T>("/me/" + resource, pageParam ? { before: pageParam } : {}),
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function AccountSecurity({ account }: { account: MeResponse }) {
  const t = useMessage();
  const client = useQueryClient();
  const personId = account.person.id;
  const sessions = useAccountList<SessionPage>(personId, "sessions");
  const history = useAccountList<SecurityEventPage>(personId, "security-events");
  const revoke = useMutation({
    mutationFn: (id: string | null) =>
      id ? http.delete("/me/sessions/" + id) : http.post("/me/sessions/revoke-others"),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.accountSecurity(personId) }),
    meta: { inlineErrors: true },
  });
  const accept = useMutation({
    mutationFn: (termsVersion: string) => http.post("/me/terms", { acceptTerms: true, termsVersion }),
    onSettled: () => client.invalidateQueries({ queryKey: keys.me }),
    meta: { inlineErrors: true },
  });
  const devices = sessions.data?.pages.flatMap((page) => page.items) ?? [];
  const events = history.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      {account.termsAcceptanceRequired && account.termsVersion && (
        <section className={styles.panel}>
          <h2>{t("account.updatedTerms")}</h2>
          <form
            key={account.termsVersion}
            className={styles.securityForm}
            onSubmit={(e) => {
              e.preventDefault();
              accept.mutate(account.termsVersion!);
            }}
          >
            <TermsConfirmation />
            <Button type="submit" variant="primary" loading={accept.isPending} retryError={accept.error}>
              {t("account.saveAcceptance")}
            </Button>
            <FormError error={accept.error} />
          </form>
        </section>
      )}
      <section className={styles.panel}>
        <h2>{t("account.limits")}</h2>
        <div className={styles.tier}>
          <strong>{t(`account.tier.${account.trustTier}`)}</strong>
          {account.trustNextStep && (
            <p className={styles.muted}>{t(`account.next.${account.trustNextStep}`)}</p>
          )}
        </div>
      </section>
      <section className={styles.panel}>
        <h2>{t("account.sessions")}</h2>
        <ul className={styles.securityRows}>
          {devices.map((device) => (
            <li key={device.id}>
              <span className={styles.deviceIcon}>
                <Monitor aria-hidden="true" size={20} />
              </span>
              <div className={styles.deviceDetails}>
                <strong>{device.userAgentFamily ?? t("account.otherClient")}</strong>{" "}
                {device.current && <Badge>{t("account.currentSession")}</Badge>}
                <p className={styles.muted}>
                  {t("account.sessionDates", {
                    start: formatDateTime(device.createdAt),
                    last: formatDateTime(device.lastUsedAt),
                  })}
                </p>
              </div>
              {!device.current && (
                <Button
                  size="sm"
                  disabled={revoke.isPending}
                  retryError={revoke.error}
                  onClick={() => revoke.mutate(device.id)}
                >
                  {t("account.endSession")}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <FormError error={sessions.error ?? revoke.error} />
        <div className={styles.securityActions}>
          {sessions.hasNextPage && (
            <Button loading={sessions.isFetchingNextPage} onClick={() => void sessions.fetchNextPage()}>
              {t("account.moreSessions")}
            </Button>
          )}
          {devices.some((d) => !d.current) && (
            <Button loading={revoke.isPending} retryError={revoke.error} onClick={() => revoke.mutate(null)}>
              {t("account.endOthers")}
            </Button>
          )}
        </div>
        <p role="status">
          {revoke.isSuccess &&
            t(revoke.variables ? "account.event.session_revoked" : "account.event.other_sessions_revoked")}
        </p>
      </section>
      <section className={styles.panel}>
        <h2>{t("account.securityHistory")}</h2>
        <ul className={styles.securityRows}>
          {events.map((event) => (
            <li key={event.id}>
              <span className={styles.deviceDetails}>
                <strong>{t(`account.event.${event.kind}`)}</strong>
                {event.userAgentFamily && <> · {event.userAgentFamily}</>}
              </span>
              <time className={styles.muted} dateTime={event.createdAt}>
                {formatDateTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ul>
        {history.isSuccess && !events.length && <p>{t("account.noHistory")}</p>}
        <FormError error={history.error} />
        {history.hasNextPage && (
          <Button loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
            {t("account.moreEvents")}
          </Button>
        )}
      </section>
    </>
  );
}
