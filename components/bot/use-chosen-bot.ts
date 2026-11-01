"use client";

// The visitor's chosen bot, shared by every bot on the site (the home hero
// now, the assistant's avatar later). Remembered in localStorage; the server
// and the first client render use the default, and the stored one swaps in
// after hydration inside the same fixed box.

import { useSyncExternalStore } from "react";
import { DEFAULT_BOT, isBotType, type BotType } from "./bot-types";

export const BOT_STORAGE_KEY = "loakraken-bot";

const listeners = new Set<() => void>();
/** The choice when storage is blocked: kept for this page only. */
let fallback: BotType | null = null;

function subscribe(callback: () => void) {
  listeners.add(callback);
  // Another tab choosing.
  const onStorage = (event: StorageEvent) => {
    if (event.key === BOT_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function read(): BotType {
  try {
    const stored = localStorage.getItem(BOT_STORAGE_KEY);
    return isBotType(stored) ? stored : DEFAULT_BOT;
  } catch {
    // Storage blocked: the default.
    return DEFAULT_BOT;
  }
}

export function chooseBot(type: BotType) {
  try {
    if (type === DEFAULT_BOT) localStorage.removeItem(BOT_STORAGE_KEY);
    else localStorage.setItem(BOT_STORAGE_KEY, type);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
    fallback = type;
  }
  listeners.forEach((listener) => listener());
}

export function useChosenBot(): [BotType, (type: BotType) => void] {
  const type = useSyncExternalStore(subscribe, () => fallback ?? read(), () => DEFAULT_BOT);
  return [type, chooseBot];
}
