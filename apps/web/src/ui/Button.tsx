import { useEffect, useReducer } from "react";
import { ApiError } from "@/api/http";
import { createLink } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "@/lib/cx";
import styles from "./Button.module.scss";
import { Spinner } from "./Feedback";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

interface StyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  /** Square, icon-only button; give it an aria-label. */
  iconOnly?: boolean;
}

export const buttonClass = ({ variant = "secondary", size = "md", block, iconOnly }: StyleProps = {}) =>
  cx(styles.button, styles[variant], styles[size], block && styles.block, iconOnly && styles.iconOnly);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  loading?: boolean;
  retryError?: unknown;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant,
  size,
  block,
  iconOnly,
  loading,
  retryError,
  icon,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const deadline = retryError instanceof ApiError ? retryError.retryAt : undefined;
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    if (!deadline) return;
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      const remaining = deadline - Date.now();
      if (remaining > 0) timer = setTimeout(wake, Math.min(remaining, 2_147_483_647));
      else refresh();
    };
    wake();
    return () => clearTimeout(timer);
  }, [deadline]);
  return (
    <button
      type={type}
      className={cx(buttonClass({ variant, size, block, iconOnly }), className)}
      disabled={disabled || loading || (!!deadline && Date.now() < deadline)}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}

function ButtonAnchor({
  variant,
  size,
  block,
  iconOnly,
  className,
  ref,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & StyleProps & { ref?: Ref<HTMLAnchorElement> }) {
  return <a ref={ref} className={cx(buttonClass({ variant, size, block, iconOnly }), className)} {...rest} />;
}

/** A router link that looks like a button (keeps full route type-safety). */
export const ButtonLink = createLink(ButtonAnchor);
