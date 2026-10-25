"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Clip the selected-style copy to the current tab; `slide` animates the move.
 * `show` also scrolls the row to the tab; true when it scrolled.
 */
function place(nav: HTMLElement | null, copy: HTMLElement | null, slide: boolean, show: boolean) {
  const active = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
  if (!nav || !copy || !active) return false;
  const left = active.offsetLeft;
  const right = Math.max(0, copy.offsetWidth - left - active.offsetWidth);
  copy.toggleAttribute("data-instant", !slide);
  copy.style.clipPath = `inset(0 ${right}px 0 ${left}px round 980px)`;
  nav.dataset.pill = "on";
  return show && reveal(nav, active);
}

/**
 * Scroll the tab row (never the page) so the current tab sits clear of the
 * edge fades. On a phone the row scrolls, and a tab past its end was left
 * cut in the fade: 스펙업 showed as '스펙ㅇ', which read like a stray 0 before
 * 더보기 (live, 390).
 */
function reveal(nav: HTMLElement, active: HTMLElement) {
  if (nav.scrollWidth <= nav.clientWidth) return false;
  // The fade at each end (scroll-fade-x): min(12%, 40px) of the row.
  const fade = Math.min(nav.clientWidth * 0.12, 40);
  const start = active.offsetLeft - fade;
  const end = active.offsetLeft + active.offsetWidth + fade - nav.clientWidth;
  const before = nav.scrollLeft;
  if (before > start) nav.scrollLeft = Math.max(0, start);
  else if (before < end) nav.scrollLeft = end;
  return nav.scrollLeft !== before;
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
  // The row was scrolled by hand (or a test) since the tab was chosen; and
  // whether the next scroll event is our own reveal.
  const touched = useRef(false);
  const ours = useRef(false);

  useLayoutEffect(() => {
    touched.current = false;
    ours.current = place(nav.current, layer.current, placed.current && !keyboard.current, true);
    placed.current = true;
  }, [tab]);

  // Widths change with fonts, the viewport and the refresh countdown beside
  // the row (every second while it counts): follow them without sliding, and
  // keep the tab in view only until the row is scrolled by hand. Pulling it
  // back each second undid a hand scroll, and a tab click then missed (#1077).
  // The observer's first report is the size it starts with, so it is skipped.
  useLayoutEffect(() => {
    const row = nav.current;
    let first = true;
    const resize = new ResizeObserver(() => {
      if (first) first = false;
      else if (place(nav.current, layer.current, false, !touched.current)) ours.current = true;
    });
    const scrolled = () => {
      if (ours.current) ours.current = false;
      else touched.current = true;
    };
    if (row) {
      resize.observe(row);
      row.addEventListener("scroll", scrolled, { passive: true });
    }
    return () => {
      resize.disconnect();
      row?.removeEventListener("scroll", scrolled);
    };
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
