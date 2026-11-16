import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * For in-place view switches (navigations with `resetScroll: false`): when `key` changes, bring `ref` back into
 * view only if the reader had scrolled past its top. A list that was replaced should start at its first item —
 * without jumping to the top of the page, which is what the router's default scroll reset does.
 */
export function useRevealOnChange(ref: RefObject<Element | null>, key: unknown): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    // The sticky header's height, as html's scroll-padding-top (which scrollIntoView honours too).
    const header = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (el.getBoundingClientRect().top < header) el.scrollIntoView({ block: "start" });
  }, [ref, key]);
}

/**
 * Whether an element has scrolled up under the sticky header (e.g. to show a compact title in a sticky bar once
 * the page's own title is out of view).
 */
export function useScrolledPast(ref: RefObject<Element | null>, offset = 64): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPast(!entry!.isIntersecting && entry!.boundingClientRect.top < offset),
      { rootMargin: `-${offset}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, offset]);
  return past;
}

/** The value, updated only after it has stopped changing for `ms` (search-as-you-type). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
