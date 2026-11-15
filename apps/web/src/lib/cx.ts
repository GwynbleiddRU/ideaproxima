/** Joins class names, skipping falsy values: `cx(styles.button, active && styles.active)`. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
