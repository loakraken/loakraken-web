import type { FocusEvent } from "react";

/**
 * onFocus for a row that scrolls sideways and fades at its ends: a tab reached
 * by keyboard comes to rest at least the row's scroll-padding from each edge,
 * clear of the fade. Chrome's own focus scroll ignores scroll-padding: a tab
 * already inside the row, or half inside it, stayed in the fade (#1324). Runs
 * before that scroll, which then has nothing to do. Scrolls the row only,
 * never the page. A tab pressed by mouse or touch is not :focus-visible and
 * stays put, so the row never moves between a press and its release (#1077).
 */
export function focusClearOfFade(event: FocusEvent<HTMLElement>) {
  const row = event.currentTarget;
  const tab = event.target;
  if (tab === row || !tab.matches(":focus-visible") || row.scrollWidth <= row.clientWidth) return;
  const style = getComputedStyle(row);
  const box = row.getBoundingClientRect();
  const rect = tab.getBoundingClientRect();
  const start = rect.left - (box.left + row.clientLeft) - (parseFloat(style.scrollPaddingLeft) || 0);
  const end = rect.right - (box.left + row.clientLeft + row.clientWidth) + (parseFloat(style.scrollPaddingRight) || 0);
  if (start < 0) row.scrollLeft += start;
  else if (end > 0) row.scrollLeft += Math.min(end, start);
}
