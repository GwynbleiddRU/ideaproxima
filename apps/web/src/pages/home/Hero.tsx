import { LocalizedText, useMessage } from "@/locales/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { ArrowRight, ChevronDown, Plus, Search } from "lucide-react";
import { cx } from "@/lib/cx";
import { ButtonLink } from "@/ui/Button";
import styles from "./Hero.module.scss";

/**
 * The first screen. One message, one primary action (search) and two ways in — nothing else competes for
 * attention. It fills exactly the visible area under the header, and its type scales with the viewport's height
 * as well as its width, so it fits short laptop screens and phones alike (verified by audit/e2e/hero.spec.ts).
 */
export function Hero() {
  const t = useMessage();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // "/" focuses the search, as on most search-first sites; ignored while the visitor is typing elsewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q) void navigate({ to: "/search", search: { q } });
    else input.current?.focus();
  };

  const scrollOn = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById("discover");
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={cx("container", styles.inner)}>
        <div className={styles.text}>
          <p className={styles.eyebrow}>{t("home.hero.eyebrow")}</p>
          <h1 id="hero-title" className={styles.title}>
            <LocalizedText id="home.hero.title" components={{ 0: <em /> }} />
          </h1>
          <p className={styles.lede}>{t("home.hero.lede")}</p>
          <form role="search" className={styles.search} onSubmit={submit}>
            {/* One label around icon, input and shortcut hint: a click anywhere in the field focuses the input. */}
            <label className={styles.field}>
              <Search aria-hidden className={styles.searchIcon} />
              <span className="visually-hidden">{t("nav.searchLabel")}</span>
              <input
                ref={input}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("home.hero.searchPlaceholder")}
                enterKeyHint="search"
                autoComplete="off"
              />
              {/* A keyboard-shortcut hint (press "/" anywhere on the page), not a control. */}
              <kbd className={styles.kbd} aria-hidden title={t("home.hero.searchShortcut")}>
                {"/"}
              </kbd>
            </label>
            <button type="submit" className={styles.searchButton}>
              {t("nav.search")}
            </button>
          </form>
          <div className={styles.actions}>
            <ButtonLink to="/explore" variant="primary" size="lg">
              {t("explore.title")} <ArrowRight />
            </ButtonLink>
            <ButtonLink to="/new" variant="secondary" size="lg">
              <Plus /> {t("nav.propose")}
            </ButtonLink>
          </div>
        </div>
        <HeroVisual />
      </div>
      <a href="#discover" className={styles.cue} onClick={scrollOn}>
        <span>{t("home.showcase.eyebrow")}</span>
        <ChevronDown aria-hidden />
      </a>
    </section>
  );
}

const FOCUS = { x: 280, y: 250 };
const NEEDS = [
  { x: 110, y: 128, r: 9 },
  { x: 74, y: 262, r: 12 },
  { x: 118, y: 390, r: 8 },
];
const ENABLES = [
  { x: 452, y: 118, r: 10 },
  { x: 488, y: 258, r: 13 },
  { x: 440, y: 392, r: 9 },
];
/** Alternatives and complements: dashed side links, as in the connection map. */
const LATERAL = [
  { from: { x: 196, y: 58 }, to: NEEDS[0]!, r: 5 },
  { from: { x: 352, y: 462 }, to: ENABLES[2]!, r: 6 },
  { from: { x: 538, y: 372 }, to: ENABLES[1]!, r: 5 },
];

/** A horizontal Bézier, so connections read left to right like the connection map. */
const curve = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  `M${a.x} ${a.y} C${a.x + 90} ${a.y}, ${b.x - 90} ${b.y}, ${b.x} ${b.y}`;

/**
 * The product in one picture: an idea, what it needs (left) and what it would enable (right). Decorative, so it
 * is hidden from assistive technology; motion is a slow flow along the connections and stops when the visitor
 * prefers reduced motion.
 */
function HeroVisual() {
  const t = useMessage();
  return (
    <div className={styles.visual} aria-hidden>
      <svg viewBox="0 0 560 520" className={styles.svg}>
        <circle cx={FOCUS.x} cy={FOCUS.y} r={150} className={cx(styles.orbit, styles.orbitSlow)} />
        <circle cx={FOCUS.x} cy={FOCUS.y} r={92} className={cx(styles.orbit, styles.orbitFast)} />

        {NEEDS.map((n, i) => (
          <g key={`need-${i}`}>
            <path d={curve(n, FOCUS)} className={styles.edge} />
            <path d={curve(n, FOCUS)} className={styles.flow} style={{ animationDelay: `${i * -1.1}s` }} />
          </g>
        ))}
        {ENABLES.map((n, i) => (
          <g key={`enable-${i}`}>
            <path d={curve(FOCUS, n)} className={styles.edge} />
            <path
              d={curve(FOCUS, n)}
              className={styles.flow}
              style={{ animationDelay: `${i * -0.9 - 0.5}s` }}
            />
          </g>
        ))}
        {LATERAL.map((l, i) => (
          <line
            key={`lateral-${i}`}
            x1={l.from.x}
            y1={l.from.y}
            x2={l.to.x}
            y2={l.to.y}
            className={styles.lateral}
          />
        ))}

        {LATERAL.map((l, i) => (
          <circle key={`far-${i}`} cx={l.from.x} cy={l.from.y} r={l.r} className={styles.farNode} />
        ))}
        {NEEDS.map((n, i) => (
          <circle key={`need-node-${i}`} cx={n.x} cy={n.y} r={n.r} className={styles.needNode} />
        ))}
        {ENABLES.map((n, i) => (
          <circle key={`enable-node-${i}`} cx={n.x} cy={n.y} r={n.r} className={styles.enableNode} />
        ))}

        <circle cx={FOCUS.x} cy={FOCUS.y} r={30} className={styles.pulse} />
        <circle cx={FOCUS.x} cy={FOCUS.y} r={44} className={styles.halo} />
        <circle cx={FOCUS.x} cy={FOCUS.y} r={22} className={styles.focus} />

        <text x={FOCUS.x} y={FOCUS.y + 72} className={styles.focusLabel}>
          {t("home.hero.idea")}
        </text>
        <text x={96} y={484} className={styles.label}>
          {t("home.hero.needs")}
        </text>
        <text x={464} y={484} className={styles.label}>
          {t("home.hero.enables")}
        </text>
      </svg>
    </div>
  );
}
