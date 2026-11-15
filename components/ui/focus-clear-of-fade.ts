import type { FocusEvent } from "react";

/**
 * Brings `tab` to rest at least the row's scroll-padding from each edge, clear
 * of the fade. A tab wider than the clear middle can't clear both fades: it is
 * centred. Scrolls the row only, never the page.
 */
export function clearOfFade(row: HTMLElement, tab: HTMLElement) {
  if (row.scrollWidth <= row.clientWidth) return;
  const style = getComputedStyle(row);
  const padStart = parseFloat(style.scrollPaddingLeft) || 0;
  const padEnd = parseFloat(style.scrollPaddingRight) || 0;
  const left = row.getBoundingClientRect().left + row.clientLeft;
  const rect = tab.getBoundingClientRect();
  if (rect.width > row.clientWidth - padStart - padEnd) {
    row.scrollLeft += rect.left + rect.width / 2 - (left + row.clientWidth / 2);
    return;
  }
  const start = rect.left - left - padStart;
  const end = rect.right - (left + row.clientWidth) + padEnd;
  if (start < 0) row.scrollLeft += start;
  else if (end > 0) row.scrollLeft += end;
}

/**
 * onFocus for a row that scrolls sideways and fades at its ends: a tab reached
 * by keyboard comes to rest clear of the fade (clearOfFade). Chrome's own focus
 * scroll ignores scroll-padding: a tab already inside the row, or half inside
 * it, stayed in the fade (#1324). Runs before that scroll, which then has
 * nothing to do. A tab pressed by mouse or touch is not :focus-visible and
 * stays put, so the row never moves between a press and its release (#1077).
 */
export function focusClearOfFade(event: FocusEvent<HTMLElement>) {
  const row = event.currentTarget;
  const tab = event.target;
  if (tab === row || !tab.matches(":focus-visible")) return;
  clearOfFade(row, tab);
}
