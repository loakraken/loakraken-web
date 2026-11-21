"use client";
// One way for every tool to keep what was typed (코덱스 QA 10-18 P1, #889): the
// value lives in the address, the same as 멀티서치. Back, reload and a shared
// link all come back with it. The field starts from the address on mount
// (useSearchParams: the entry's current address, not the server's first
// answer) and writes each change back with a plain replaceState(null), which
// the router syncs without a navigation. A value equal to its default leaves
// the address. The page must render per request (connection()) so the first
// HTML already has the values.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export type UrlCodec<T> = {
  /** null when the address holds something this field does not accept. */
  parse: (raw: string) => T | null;
  format: (value: T) => string;
};

export const textCodec = (maxLength = 40): UrlCodec<string> => ({
  parse: (raw) => (raw.length <= maxLength ? raw : null),
  format: (value) => value,
});
export const boolCodec: UrlCodec<boolean> = {
  parse: (raw) => (raw === "1" ? true : raw === "0" ? false : null),
  format: (value) => (value ? "1" : "0"),
};
export const intCodec = (min: number, max: number): UrlCodec<number> => ({
  parse: (raw) => {
    const n = Number(raw);
    return /^-?\d+$/.test(raw) && n >= min && n <= max ? n : null;
  },
  format: (value) => String(value),
});
export const oneOfCodec = <T extends string>(values: readonly T[]): UrlCodec<T> => ({
  parse: (raw) => (values.includes(raw as T) ? (raw as T) : null),
  format: (value) => value,
});

/** Writes one key into the current address (or drops it), keeping the rest. */
export function writeUrlParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value == null || value === "") url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`)
    // A plain replaceState (null state): the router syncs it into useSearchParams.
    window.history.replaceState(null, "", next);
}

/**
 * useState whose value is kept in the address under `key`. An address change from outside (a link to the same page,
 * back · forward) is taken in (codex #1895 P2: Next keeps the state across a query change, so the controls stayed
 * on the old value). Only when the address the router reports is the browser's current one: the router can still be
 * delivering an earlier replaceState of ours, and taking that in would undo a newer pick (and write it back).
 */
export function useUrlState<T>(key: string, fallback: T, codec: UrlCodec<T>) {
  const params = useSearchParams();
  const raw = params.get(key);
  const read = (from: string | null) => (from == null ? fallback : (codec.parse(from) ?? fallback));
  const [value, setValue] = useState<T>(() => read(raw));
  const [seen, setSeen] = useState(raw);
  if (raw !== seen) {
    // Adjusting state from a changed input during render (React's 'storing information from previous renders').
    setSeen(raw);
    const current = typeof window === "undefined" ? raw : new URL(window.location.href).searchParams.get(key);
    const next = read(raw);
    if (current === raw && codec.format(next) !== codec.format(value)) setValue(next);
  }
  const formatted = codec.format(value);
  const isDefault = formatted === codec.format(fallback);
  useEffect(() => {
    writeUrlParam(key, isDefault ? null : formatted);
  }, [key, formatted, isDefault]);
  return [value, setValue] as const;
}
