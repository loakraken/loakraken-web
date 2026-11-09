// The homework tool's saved state, shared with the character page's 주간 획득
// 골드 (#14): one store (this browser's localStorage), read by both screens,
// so a raid turned on in one is on in the other. Writes from this tab tell the
// other readers at once; the browser's storage event covers other tabs.
import { useSyncExternalStore } from "react";
import { STORAGE_KEY, parseState, weekStart, type HomeworkState } from "./homework";

const CHANGED = "loakraken-homework-changed";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** The saved text now (for a change made in an event handler). */
export function readSavedHomework(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode): nothing saved.
    return null;
  }
}

/**
 * The saved text, or undefined while rendering on the server (the page then
 * shows the automatic setup, the same as a browser with nothing saved).
 */
export const useSavedHomework = () => useSyncExternalStore(subscribe, readSavedHomework, () => undefined);

const noChange = () => () => {};
const thisWeek = () => weekStart(Date.now());
/**
 * The homework week now (its start, the same all week), or null while rendering
 * on the server. Reading saved homework with it keeps this week's ticks and
 * 더보기; with no clock they would read as last week's and reset (codex P2).
 */
export const useHomeworkWeek = () => useSyncExternalStore(noChange, thisWeek, () => null);

/** The saved state, or null when nothing (or nothing readable) is saved. */
export function savedState(text: string | null | undefined, now: number): HomeworkState | null {
  if (!text) return null;
  const state = parseState(text, now);
  return state.characters.length ? state : null;
}

/** Saves and tells this tab's readers (the homework tool, the 주간 획득 골드 panel). */
export function saveHomework(state: HomeworkState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not saved (private mode): the panel, which reads the store, stays as it was.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Listens for saves made elsewhere (another tab, or the panel), for the homework tool. */
export const onHomeworkSaved = subscribe;
