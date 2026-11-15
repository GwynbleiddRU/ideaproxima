import type { CSSProperties } from "react";
import { initials } from "@/lib/format";
import styles from "./Avatar.module.scss";

/** Stable hue per person, so the same contributor is recognisable across pages. */
function hue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ name, seed, size = 32 }: { name: string; seed: string; size?: number }) {
  const style = { "--size": `${size}px`, "--hue": hue(seed) } as CSSProperties;
  return (
    <span className={styles.avatar} style={style} aria-hidden>
      {initials(name)}
    </span>
  );
}
