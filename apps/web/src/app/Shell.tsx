import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { LogOut, Menu, Moon, Plus, Search, Settings, Shield, Sun, User } from "lucide-react";
import { useLogout, useSession } from "@/api/session";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocalizedText, useMessage } from "@/locales/react";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";
import { resolvedTheme, setTheme, useTheme, type ThemePreference } from "@/lib/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, ButtonLink } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Dropdown, menuItemClass, menuLabelClass, menuSeparatorClass } from "@/ui/Dropdown";
import { Logo } from "@/ui/Logo";
import { Segmented } from "@/ui/Segmented";
import { Toaster } from "@/ui/Toast";
import styles from "./Shell.module.scss";

const NAV = [
  { to: "/explore", label: "nav.explore" },
  { to: "/topics", label: "nav.topics" },
  { to: "/activity", label: "nav.activity" },
  { to: "/about", label: "nav.principles" },
] as const;

function ProgressBar() {
  const pending = useRouterState({ select: (s) => s.status === "pending" });
  return <div className={cx(styles.progress, pending && styles.progressActive)} aria-hidden />;
}

function ThemeButton() {
  const t = useMessage();
  const preference = useTheme();
  const dark = resolvedTheme(preference) === "dark";
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      aria-label={dark ? t("theme.useLight") : t("theme.useDark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

function HeaderSearch() {
  const t = useMessage();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (q.trim()) void navigate({ to: "/search", search: { q: q.trim() } });
  };
  return (
    <form role="search" className={styles.search} onSubmit={submit}>
      <Search size={15} aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("nav.searchPlaceholder")}
        aria-label={t("nav.searchLabel")}
        type="search"
      />
    </form>
  );
}

function AccountMenu() {
  const t = useMessage();
  const { me, isModerator } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <Dropdown
      label={`${initials(me.displayName)} · ${t("nav.account")}`}
      triggerClassName={styles.avatarButton}
      trigger={<Avatar name={me.displayName} seed={me.handle} size={32} />}
    >
      {(close) => (
        <>
          <p className={menuLabelClass}>
            <LocalizedText id="nav.signedIn" values={{ handle: me.handle }} components={{ 0: <bdi /> }} />
          </p>
          <Link
            to="/people/$handle"
            params={{ handle: me.handle }}
            className={menuItemClass}
            role="menuitem"
            onClick={close}
          >
            <User /> {t("nav.profile")}
          </Link>
          <Link to="/account" className={menuItemClass} role="menuitem" onClick={close}>
            <Settings /> {t("nav.settings")}
          </Link>
          {isModerator && (
            <Link
              to="/activity"
              search={{ action: "moderation." }}
              className={menuItemClass}
              role="menuitem"
              onClick={close}
            >
              <Shield /> {t("nav.moderation")}
            </Link>
          )}
          <div className={menuSeparatorClass} />
          <button
            type="button"
            className={menuItemClass}
            role="menuitem"
            onClick={() => {
              close();
              logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/" }) });
            }}
          >
            <LogOut /> {t("nav.signOut")}
          </button>
        </>
      )}
    </Dropdown>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useMessage();
  const { me } = useSession();
  return (
    <Dialog open={open} onClose={onClose} title={t("nav.menu")} closeLabel={t("locale.close")} size="sm">
      <nav aria-label={t("nav.main")} className={styles.mobileNav}>
        {NAV.map((item) => (
          <Link key={item.to} to={item.to} onClick={onClose}>
            {t(item.label)}
          </Link>
        ))}
        <Link to="/search" onClick={onClose}>
          {t("nav.search")}
        </Link>
        <hr />
        {me ? (
          <>
            <Link to="/people/$handle" params={{ handle: me.handle }} onClick={onClose}>
              {t("nav.profile")}
            </Link>
            <Link to="/account" onClick={onClose}>
              {t("nav.settings")}
            </Link>
          </>
        ) : (
          <Link to="/sign-in" onClick={onClose}>
            {t("auth.signIn")}
          </Link>
        )}
        <Link to="/new" onClick={onClose} className={styles.mobilePrimary}>
          {t("nav.propose")}
        </Link>
      </nav>
    </Dialog>
  );
}

function Footer() {
  const t = useMessage();
  const preference = useTheme();
  return (
    <footer className={styles.footer}>
      <div className={cx("container", styles.footerInner)}>
        <div className={styles.footerBrand}>
          <Link to="/" className={styles.brand}>
            <Logo size={22} /> {t("brand.name")}
          </Link>
          <p>{t("footer.description")}</p>
        </div>
        <nav aria-label={t("nav.footer")} className={styles.footerLinks}>
          <div>
            <p className="eyebrow">{t("footer.discover")}</p>
            <Link to="/explore">{t("nav.explore")}</Link>
            <Link to="/explore" search={{ lens: "neglected" }}>
              {t("footer.neglected")}
            </Link>
            <Link to="/topics">{t("nav.topics")}</Link>
          </div>
          <div>
            <p className="eyebrow">{t("footer.archive")}</p>
            <Link to="/activity">{t("nav.activity")}</Link>
            <Link to="/activity" search={{ action: "moderation." }}>
              {t("nav.moderation")}
            </Link>
            <Link to="/about">{t("nav.principles")}</Link>
          </div>
          <div>
            <p className="eyebrow">{t("footer.build")}</p>
            <a href="/v1">{t("footer.api")}</a>
            <a href="/v1/openapi.json">{t("footer.openApi")}</a>
          </div>
        </nav>
        <div className={styles.footerTheme}>
          <Segmented<ThemePreference>
            label={t("theme.name")}
            size="sm"
            value={preference}
            onChange={setTheme}
            options={[
              { value: "system", label: t("theme.system") },
              { value: "light", label: t("theme.light") },
              { value: "dark", label: t("theme.dark") },
            ]}
          />
        </div>
      </div>
    </footer>
  );
}

export function Shell() {
  const t = useMessage();
  const { me, loading } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ownSearch = pathname === "/" || pathname === "/search";
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        {t("nav.skip")}
      </a>
      <header className={styles.header}>
        <div className={cx("container", styles.headerInner)}>
          <Link to="/" className={styles.brand} aria-label={t("nav.home")}>
            <Logo /> <span>{t("brand.name")}</span>
          </Link>
          <nav aria-label={t("nav.main")} className={styles.nav}>
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className={styles.navLink}>
                {t(item.label)}
              </Link>
            ))}
          </nav>
          {/* Home and Search have their own search box; a second one in the header would only compete. */}
          {ownSearch ? <span className={styles.spacer} aria-hidden /> : <HeaderSearch />}
          <div className={styles.actions}>
            <LanguageSwitcher />
            <ThemeButton />
            {!loading && !me && (
              <ButtonLink to="/sign-in" variant="ghost" size="sm" className={styles.signIn}>
                {t("auth.signIn")}
              </ButtonLink>
            )}
            <AccountMenu />
            <ButtonLink to="/new" variant="primary" size="sm" className={styles.propose}>
              <Plus /> {t("nav.propose")}
            </ButtonLink>
            {!ownSearch && (
              <ButtonLink
                to="/search"
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={t("nav.search")}
                className={styles.mobileOnly}
              >
                <Search />
              </ButtonLink>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={t("nav.openMenu")}
              className={styles.mobileOnly}
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </Button>
          </div>
        </div>
        <ProgressBar />
      </header>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Toaster />
    </div>
  );
}
