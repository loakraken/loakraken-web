"use client";
// The 지옥 · 나락 tool's typed values (1개 값, keyed by item name: lib unitKey / unsettledKey) kept in
// this browser, so reload, Back and a later visit come back with them (codex QA v0.3.11 P1).
// A tiny store over localStorage, like the shop tool's rate: the server and the first paint see
// no values; when storage is blocked the values still work for this visit (memory).

import { useSyncExternalStore, type SetStateAction } from "react";

// Versioned (codex #1549 P3): a later shape change takes a new key and never reads old data.
const KEY = "loakraken:hell-reward:values:v1";
const MAX_KEYS = 200;

/** Only well-formed entries survive a stored or tampered value: item keys and digit text. */
export function cleanValues(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  // The newest entries are kept at the cap (codex #1549 P3): a value typed now is never the one dropped.
  for (const [k, v] of Object.entries(raw).slice(-MAX_KEYS))
    if (/^(item|unsettled):/.test(k) && k.length <= 80 && typeof v === "string" && /^[\d.]{1,16}$/.test(v))
      out[k] = v;
  return out;
}

let memory: string | null = null;
const listeners = new Set<() => void>();

function readText() {
  if (memory != null) return memory;
  try {
    return window.localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab typing a value: this tab follows.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const parse = (text: string) => {
  try {
    return cleanValues(JSON.parse(text));
  } catch {
    return {};
  }
};
let cache = { text: "{}", values: {} as Record<string, string> };
const valuesOf = (text: string) => {
  if (cache.text !== text) cache = { text, values: parse(text) };
  return cache.values;
};

function write(values: Record<string, string>) {
  const text = JSON.stringify(cleanValues(values));
  try {
    if (text === "{}") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, text);
    memory = null;
  } catch {
    // Storage blocked: the values still work for this visit.
    memory = text;
  }
  listeners.forEach((listener) => listener());
}

/** Entries whose value changed move to the end, so the cap drops the least recently typed. */
export function touchedLast(before: Record<string, string>, next: Record<string, string>) {
  const changed = Object.keys(next).filter((k) => before[k] !== next[k]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(next)) if (!changed.includes(k)) out[k] = v;
  for (const k of changed) out[k] = next[k];
  return out;
}

const noop = () => () => {};

/** [values, setValues, restored]: like useState, kept in this browser. */
export function useHellValues() {
  const text = useSyncExternalStore(subscribe, readText, () => "{}");
  const values = valuesOf(text);
  const setValues = (update: SetStateAction<Record<string, string>>) => {
    const before = valuesOf(readText());
    write(touchedLast(before, typeof update === "function" ? update(before) : update));
  };
  // false on the server and the first paint (no stored values yet), true once they apply.
  const restored = useSyncExternalStore(noop, () => true, () => false);
  return [values, setValues, restored] as const;
}
