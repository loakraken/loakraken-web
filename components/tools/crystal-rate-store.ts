"use client";

// The user's in-game crystal exchange rate (gold per 100 blue crystals), one value for the 로아샵 효율 계산기 and
// the 시세 screen's 블루 크리스탈 card. It stays in this browser only and is never sent anywhere; there is no
// default and no fetched value (no official feed of the rate exists).
import { useSyncExternalStore } from "react";
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
const subscribeRate = (listener: () => void) => {
  rateListeners.add(listener);
  return () => {
    rateListeners.delete(listener);
  };
};

/**
 * The text as typed (kept as is, so a wrong character stays visible instead of being dropped), a setter, the rate
 * it reads as (null when empty or invalid), and whether it is invalid.
 */
export function useCrystalRate() {
  const text = useSyncExternalStore(subscribeRate, readRate, () => "");
  const change = (typed: string) => writeRate(typed);
  return { text, change, ...checkRate(text) };
}
