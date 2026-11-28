"use client";
// 지옥 · 나락 보상: the roster quick switch (X4 (a), web #1975). A roster loaded once by one character's name (our roster
// api, as the 숙제 tool), kept in this browser; a character's card sets the key level it can enter. The key level is
// the only thing the tool takes from a character (kind and clear stage are the user's). No 특수 재련 target pick:
// 2부 removes 특수 재련 (PM 총괄 11-28).
// The same tiny store over localStorage as hell-reward-values.ts: the server and the first paint see no roster.

import { useSyncExternalStore } from "react";
import { characterNameError, normalizeCharacterName } from "../character/model";
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
const CLASS_MAX = 30;

/**
 * One member as kept, or null when it breaks a rule: only that member is dropped, never the roster (PM-프론트 #1976
 * P3). Names follow the site's own rule (letters and digits, as every character lookup checks them), so a real name
 * of 12 Hangul, digits or mixed-case letters is kept.
 */
export function memberOf(raw: unknown): RosterMember | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { characterName, className, itemLevel } = raw as Record<string, unknown>;
  if (typeof characterName !== "string" || characterNameError(characterName)) return null;
  if (typeof className !== "string" || className.length > CLASS_MAX) return null;
  if (typeof itemLevel !== "number" || !Number.isFinite(itemLevel) || itemLevel < 0 || itemLevel > 3000) return null;
  return { characterName: normalizeCharacterName(characterName), className, itemLevel };
}

/** The members that pass, each name once, highest item level first (ties by name), at most 30. */
function keptMembers(list: readonly unknown[]): RosterMember[] {
  const seen = new Set<string>();
  const members: RosterMember[] = [];
  for (const raw of list) {
    const m = memberOf(raw);
    if (m && !seen.has(m.characterName)) {
      seen.add(m.characterName);
      members.push(m);
    }
  }
  return members
    .sort((a, b) => b.itemLevel - a.itemLevel || a.characterName.localeCompare(b.characterName, "ko"))
    .slice(0, MAX_MEMBERS);
}

const validTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** The answer as kept, checked by the same rules as a stored one; null when no member is left (said as a failure). */
export function rosterOf(envelope: SiblingsEnvelope): HellRoster | null {
  const members = keptMembers(envelope.data.siblings);
  if (!members.length || !validTime(envelope.data.fetchedAt)) return null;
  const asked = normalizeCharacterName(envelope.data.characterName);
  return { name: characterNameError(asked) ? members[0].characterName : asked, fetchedAt: envelope.data.fetchedAt, members, picked: null };
}

/** A stored roster as read back: a tampered or older value reads as none; a bad member is dropped, the rest kept. */
export function cleanRoster(raw: unknown): HellRoster | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || characterNameError(r.name) || !validTime(r.fetchedAt) || !Array.isArray(r.members)) return null;
  const members = keptMembers(r.members);
  if (!members.length) return null;
  const picked = typeof r.picked === "string" && members.some((m) => m.characterName === r.picked) ? r.picked : null;
  return { name: normalizeCharacterName(r.name), fetchedAt: r.fetchedAt, members, picked };
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
