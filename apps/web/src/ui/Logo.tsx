import styles from "./Logo.module.scss";

/** The ideaproxima mark: an idea (ring) with the ideas it connects to. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={styles.logo}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <circle cx="12" cy="16" r="4.5" fill="none" stroke="var(--bg)" strokeWidth="2" />
      <circle cx="22.5" cy="10" r="2.5" fill="var(--bg)" />
      <circle cx="22.5" cy="22" r="2.5" fill="var(--bg)" opacity=".6" />
      <path
        d="M16 14.2 20.3 11.4M16 17.8l4.3 2.8"
        stroke="var(--bg)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
