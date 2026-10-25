"use client";

import { useLayoutEffect, useRef } from "react";

/** Clip the selected-style copy to the current tab; `slide` animates the move. */
function place(nav: HTMLElement | null, copy: HTMLElement | null, slide: boolean) {
  const active = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
  if (!nav || !copy || !active) return;
  const left = active.offsetLeft;
  const right = Math.max(0, copy.offsetWidth - left - active.offsetWidth);
  copy.toggleAttribute("data-instant", !slide);
  copy.style.clipPath = `inset(0 ${right}px 0 ${left}px round 980px)`;
  nav.dataset.pill = "on";
  reveal(nav, active);
}

/**
 * Scroll the tab row (never the page) so the current tab sits clear of the
 * edge fades. On a phone the row scrolls, and a tab past its end was left
 * cut in the fade: 스펙업 showed as '스펙ㅇ', which read like a stray 0 before
 * 더보기 (live, 390).
 */
function reveal(nav: HTMLElement, active: HTMLElement) {
  if (nav.scrollWidth <= nav.clientWidth) return;
  // The fade at each end (scroll-fade-x): min(12%, 40px) of the row.
  const fade = Math.min(nav.clientWidth * 0.12, 40);
  const start = active.offsetLeft - fade;
  const end = active.offsetLeft + active.offsetWidth + fade - nav.clientWidth;
  if (nav.scrollLeft > start) nav.scrollLeft = Math.max(0, start);
  else if (nav.scrollLeft < end) nav.scrollLeft = end;
}

/**
 * Sliding tab selection (motion guide 7, item 7). A copy of the tab labels in
 * the selected style lies over the tabs, clipped to the current tab; moving
 * the clip moves the pill and its colours together. Mouse and touch slide it
 * in 200ms; the keyboard moves it at once, as does a resize or font load.
 * Until this runs (server HTML, before hydration) the copy stays hidden and
 * the current link keeps its own background.
 */
export function useTabPill(tab: string) {
  const nav = useRef<HTMLElement>(null);
  const layer = useRef<HTMLSpanElement>(null);
  const keyboard = useRef(false);
  const placed = useRef(false);

  useLayoutEffect(() => {
    place(nav.current, layer.current, placed.current && !keyboard.current);
    placed.current = true;
  }, [tab]);

  // Widths change with fonts and the viewport: follow them without sliding.
  // The observer's first report is the size it starts with, so it is skipped.
  useLayoutEffect(() => {
    let first = true;
    const resize = new ResizeObserver(() => {
      if (first) first = false;
      else place(nav.current, layer.current, false);
    });
    if (nav.current) resize.observe(nav.current);
    return () => resize.disconnect();
  }, []);

  return {
    nav,
    layer,
    onKeyDown: () => {
      keyboard.current = true;
    },
    onPointerDown: () => {
      keyboard.current = false;
    },
  };
}
