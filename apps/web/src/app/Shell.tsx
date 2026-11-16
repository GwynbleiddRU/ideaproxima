import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { LogOut, Menu, Moon, Plus, Search, Settings, Shield, Sun, User } from "lucide-react";
import { useLogout, useSession } from "@/api/session";
import { cx } from "@/lib/cx";
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
  { to: "/explore", label: "Explore" },
  { to: "/topics", label: "Topics" },
  { to: "/activity", label: "Activity" },
  { to: "/about", label: "Principles" },
] as const;

function ProgressBar() {
  const pending = useRouterState({ select: (s) => s.status === "pending" });
  return <div className={cx(styles.progress, pending && styles.progressActive)} aria-hidden />;
}

function ThemeButton() {
  const preference = useTheme();
  const dark = resolvedTheme(preference) === "dark";
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

function HeaderSearch() {
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
        placeholder="Search ideas, claims, people"
        aria-label="Search the archive"
        type="search"
      />
    </form>
  );
}

function AccountMenu() {
  const { me, isModerator } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <Dropdown
      label="Your account"
      triggerClassName={styles.avatarButton}
      trigger={<Avatar name={me.displayName} seed={me.handle} size={32} />}
    >
      {(close) => (
        <>
          <p className={menuLabelClass}>Signed in as @{me.handle}</p>
          <Link
            to="/people/$handle"
            params={{ handle: me.handle }}
            className={menuItemClass}
            role="menuitem"
            onClick={close}
          >
            <User /> Your profile
          </Link>
          <Link to="/account" className={menuItemClass} role="menuitem" onClick={close}>
            <Settings /> Account settings
          </Link>
          {isModerator && (
            <Link
              to="/activity"
              search={{ action: "moderation." }}
              className={menuItemClass}
              role="menuitem"
              onClick={close}
            >
              <Shield /> Moderation log
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
            <LogOut /> Sign out
          </button>
        </>
      )}
    </Dropdown>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useSession();
  return (
    <Dialog open={open} onClose={onClose} title="Menu" size="sm">
      <nav aria-label="Main" className={styles.mobileNav}>
        {NAV.map((item) => (
          <Link key={item.to} to={item.to} onClick={onClose}>
            {item.label}
          </Link>
        ))}
        <Link to="/search" onClick={onClose}>
          Search
        </Link>
        <hr />
        {me ? (
          <>
            <Link to="/people/$handle" params={{ handle: me.handle }} onClick={onClose}>
              Your profile
            </Link>
            <Link to="/account" onClick={onClose}>
              Account settings
            </Link>
          </>
        ) : (
          <Link to="/sign-in" onClick={onClose}>
            Sign in
          </Link>
        )}
        <Link to="/new" onClick={onClose} className={styles.mobilePrimary}>
          Propose an idea
        </Link>
      </nav>
    </Dialog>
  );
}

function Footer() {
  const preference = useTheme();
  return (
    <footer className={styles.footer}>
      <div className={cx("container", styles.footerInner)}>
        <div className={styles.footerBrand}>
          <Link to="/" className={styles.brand}>
            <Logo size={22} /> ideaproxima
          </Link>
          <p>
            A persistent, open repository of humanity's possible futures. Facts are never rewritten;
            popularity is never mistaken for quality.
          </p>
        </div>
        <nav aria-label="Footer" className={styles.footerLinks}>
          <div>
            <p className="eyebrow">Discover</p>
            <Link to="/explore">Explore</Link>
            <Link to="/explore" search={{ lens: "neglected" }}>
              Neglected ideas
            </Link>
            <Link to="/topics">Topics</Link>
          </div>
          <div>
            <p className="eyebrow">Archive</p>
            <Link to="/activity">Activity</Link>
            <Link to="/activity" search={{ action: "moderation." }}>
              Moderation log
            </Link>
            <Link to="/about">Principles</Link>
          </div>
          <div>
            <p className="eyebrow">Build on it</p>
            <a href="/v1">API</a>
            <a href="/v1/openapi.json">OpenAPI</a>
          </div>
        </nav>
        <div className={styles.footerTheme}>
          <Segmented<ThemePreference>
            label="Theme"
            size="sm"
            value={preference}
            onChange={setTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>
      </div>
    </footer>
  );
}

export function Shell() {
  const { me, loading } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ownSearch = pathname === "/" || pathname === "/search";
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={cx("container", styles.headerInner)}>
          <Link to="/" className={styles.brand} aria-label="ideaproxima home">
            <Logo /> <span>ideaproxima</span>
          </Link>
          <nav aria-label="Main" className={styles.nav}>
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className={styles.navLink}>
                {item.label}
              </Link>
            ))}
          </nav>
          {/* Home and Search have their own search box; a second one in the header would only compete. */}
          {ownSearch ? <span className={styles.spacer} aria-hidden /> : <HeaderSearch />}
          <div className={styles.actions}>
            <ThemeButton />
            {!loading && !me && (
              <ButtonLink to="/sign-in" variant="ghost" size="sm" className={styles.signIn}>
                Sign in
              </ButtonLink>
            )}
            <AccountMenu />
            <ButtonLink to="/new" variant="primary" size="sm" className={styles.propose}>
              <Plus /> Propose an idea
            </ButtonLink>
            {!ownSearch && (
              <ButtonLink
                to="/search"
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Search"
                className={styles.mobileOnly}
              >
                <Search />
              </ButtonLink>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Open menu"
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
