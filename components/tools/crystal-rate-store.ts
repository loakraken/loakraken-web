"use client";

// The user's in-game crystal exchange rate (gold per 100 blue crystals), one value for the 로아샵 효율 계산기 and
// the 시세 screen's 블루 크리스탈 card. It stays in this browser only and is never sent anywhere; there is no
// default and no fetched value (no official feed of the rate exists).
import { useState, useSyncExternalStore } from "react";
import { checkRate } from "@/lib/tools/crystal-rate";

/** The typed rate stays in this browser only (never sent anywhere). */
const RATE_KEY = "loakraken.loa-shop.rate";
// A tiny store over localStorage: read on the client only (the server and the
// first paint see ""), and kept in memory when storage is blocked.
let memoryRate: string | null = null;
const rateListeners = new Set<() => void>();
function readRate() {
  if (memoryRate !== null) return memoryRate;
  try {
    return window.localStorage.getItem(RATE_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeRate(value: string) {
  memoryRate = value;
  try {
    if (value.trim()) window.localStorage.setItem(RATE_KEY, value);
    else window.localStorage.removeItem(RATE_KEY);
  } catch {
    // Storage blocked: the value still works for this visit.
  }
  rateListeners.forEach((listener) => listener());
}
// Another tab saved or cleared the rate (codex P3 on #1889): take its value and tell this tab's screens. Nothing is
// written back. A storage clear() comes with no key.
function onStorage(event: StorageEvent) {
  if (event.key !== RATE_KEY && event.key !== null) return;
  memoryRate = event.key === null ? "" : (event.newValue ?? "");
  rateListeners.forEach((listener) => listener());
}
const subscribeRate = (listener: () => void) => {
  if (rateListeners.size === 0) {
    // Nothing listened while away (no card, no shop tool on screen): another tab may have changed the rate meanwhile,
    // with no one here to hear its storage event. Read it again (codex P3 on #1899); blocked storage keeps memory.
    try {
      memoryRate = window.localStorage.getItem(RATE_KEY) ?? "";
    } catch {
      // the value in memory stays
    }
    window.addEventListener("storage", onStorage);
  }
  rateListeners.add(listener);
  return () => {
    rateListeners.delete(listener);
    if (rateListeners.size === 0) window.removeEventListener("storage", onStorage);
  };
};

/**
 * The text as typed (kept as is, so a wrong character stays visible instead of being dropped), a setter, the rate
 * it reads as (null when empty or invalid), and whether it is invalid. Only a valid rate (or clearing the field) is
 * saved: an invalid entry stays a draft on this screen, so the last valid rate survives it and a reload brings that
 * back (codex P2 on #1889: 27300 → -27300 → reload kept '-27300' and lost 27300).
 */
export function useCrystalRate() {
  const stored = useSyncExternalStore(subscribeRate, readRate, () => "");
  // The invalid text being typed, or null while the field shows the saved rate.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? stored;
  const change = (typed: string) => {
    if (checkRate(typed).invalid) {
      setDraft(typed);
      return;
    }
    setDraft(null);
    writeRate(typed);
  };
  return { text, change, ...checkRate(text) };
}
