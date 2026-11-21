"use client";
// One way for every tool to keep what was typed (코덱스 QA 10-18 P1, #889): the
// value lives in the address, the same as 멀티서치. Back, reload and a shared
// link all come back with it. The field starts from the address on mount
// (useSearchParams: the entry's current address, not the server's first
// answer) and writes each change back with a plain replaceState(null), which
// the router syncs without a navigation. A value equal to its default leaves
// the address. The page must render per request (connection()) so the first
// HTML already has the values.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * useState whose value is kept in the address under `key`. An address change this field did not make (a link to the
 * same page, back · forward) is taken in (codex #1895 P2: Next keeps the state across a query change, so the controls
 * stayed on the old value).
 *
 * How: the field remembers the address value it last wrote or took in, and after each render compares it with the
 * browser's current address; a different one came from outside. The browser's address, not the router's answer:
 * - the router can still be delivering an earlier replaceState of ours, and taking that in would undo a newer pick;
 * - a pick followed by a click on this page's tab before the router reported the pick reads null → null on the router
 *   (Next keys useSearchParams on the URL string), so nothing keyed on it ran (codex #1895 follow-up P3). The
 *   navigation still draws this component again (the page's new payload), and the comparison runs then.
 * In a layout effect, not in render: Next writes a navigation's history entry in its commit (an insertion effect), so
 * during the render the browser still shows the old address; before paint, so the old value is never drawn.
 *
 * The address is brought to what is shown: a value this field does not accept (a hand-edited or stale link, e.g.
 * ?filter=INVALID) shows the default and leaves the address, in that history entry too (codex #1895 follow-up P3: kept
 * on purpose, so a link copied from here opens the same screen).
 */
export function useUrlState<T>(key: string, fallback: T, codec: UrlCodec<T>) {
  const params = useSearchParams();
  const [value, setValue] = useState<T>(() => {
    const raw = params.get(key);
    return raw == null ? fallback : (codec.parse(raw) ?? fallback);
  });
  const formatted = codec.format(value);
  const isDefault = formatted === codec.format(fallback);
  // The address value this field last wrote or took in (undefined before the first check).
  const known = useRef<string | null | undefined>(undefined);
  // Every render on purpose: a navigation to the same query has no changed input to key on (see above).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const current = new URL(window.location.href).searchParams.get(key);
    if (known.current === undefined) known.current = current;
    if (current === known.current) return;
    known.current = current;
    const next = current == null ? fallback : (codec.parse(current) ?? fallback);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs from the browser history (outside React), once per outside change
    if (codec.format(next) !== formatted) setValue(next);
  });
  useEffect(() => {
    writeUrlParam(key, isDefault ? null : formatted);
    known.current = new URL(window.location.href).searchParams.get(key);
  }, [key, formatted, isDefault]);
  return [value, setValue] as const;
}