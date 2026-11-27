"use client";
// 지옥 · 나락 보상: the roster quick switch (X4 (a), web #1975). A roster loaded once by one character's name (our roster
// api, as the 숙제 tool), kept in this browser; a character's card sets the key level it can enter. The key level is
// the only thing the tool takes from a character (kind and clear stage are the user's). No 특수 재련 target pick:
// 2부 removes 특수 재련 (PM 총괄 11-28).
// The same tiny store over localStorage as hell-reward-values.ts: the server and the first paint see no roster.

import { useSyncExternalStore } from "react";
import type { SiblingsEnvelope } from "../character/validate";

/** The highest key level (entry item level) at or below the item level; null below the lowest. */
export function keyLevelFor(itemLevel: number, keyLevels: readonly number[]): number | null {
  let best: number | null = null;
  for (const level of keyLevels) if (itemLevel >= level && (best == null || level > best)) best = level;
  return best;
}

export type RosterMember = { characterName: string; className: string; itemLevel: number };
/** What is kept: the roster, when our api fetched it, and the character last picked. */
export type HellRoster = { name: string; fetchedAt: string; members: RosterMember[]; picked: string | null };

const MAX_MEMBERS = 30;

/** The answer as kept: highest item level first (ties by name), at most 30. */
export function rosterOf(envelope: SiblingsEnvelope): HellRoster {
  const members = envelope.data.siblings
    .map((s) => ({ characterName: s.characterName, className: s.className, itemLevel: s.itemLevel }))
    .sort((a, b) => b.itemLevel - a.itemLevel || a.characterName.localeCompare(b.characterName, "ko"))
    .slice(0, MAX_MEMBERS);
  return { name: envelope.data.characterName, fetchedAt: envelope.data.fetchedAt, members, picked: null };
}

const NAME = /^[^\s<>"'`]{1,16}$/u;

/** Only a well-formed stored roster survives (a tampered or older value reads as none). */
export function cleanRoster(raw: unknown): HellRoster | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || !NAME.test(r.name)) return null;
  if (typeof r.fetchedAt !== "string" || Number.isNaN(Date.parse(r.fetchedAt))) return null;
  if (!Array.isArray(r.members)) return null;
  const members: RosterMember[] = [];
  for (const m of r.members.slice(0, MAX_MEMBERS)) {
    if (!m || typeof m !== "object") return null;
    const { characterName, className, itemLevel } = m as Record<string, unknown>;
    if (typeof characterName !== "string" || !NAME.test(characterName)) return null;
    if (typeof className !== "string" || className.length > 20) return null;
    if (typeof itemLevel !== "number" || !Number.isFinite(itemLevel) || itemLevel < 0 || itemLevel > 3000) return null;
    members.push({ characterName, className, itemLevel });
  }
  const picked = typeof r.picked === "string" && members.some((m) => m.characterName === r.picked) ? r.picked : null;
  return { name: r.name, fetchedAt: r.fetchedAt, members, picked };
}

// Versioned: a later shape takes a new key and never reads old data.
const KEY = "loakraken:hell-reward:roster:v1";
let memory: string | null = null;
const listeners = new Set<() => void>();

function readText() {
  if (memory != null) return memory;
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

let cache = { text: "", roster: null as HellRoster | null };
function rosterOfText(text: string) {
  if (cache.text !== text) {
    let roster: HellRoster | null = null;
    try {
      roster = text ? cleanRoster(JSON.parse(text)) : null;
    } catch {
      roster = null;
    }
    cache = { text, roster };
  }
  return cache.roster;
}

function write(roster: HellRoster | null) {
  const text = roster ? JSON.stringify(roster) : "";
  try {
    if (!text) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, text);
    memory = null;
  } catch {
    // Storage blocked: the roster still works for this visit.
    memory = text;
  }
  listeners.forEach((listener) => listener());
}

/** [roster, setRoster]: null on the server and the first paint, then what this browser kept. */
export function useHellRoster() {
  const text = useSyncExternalStore(subscribe, readText, () => "");
  return [rosterOfText(text), write] as const;
}
