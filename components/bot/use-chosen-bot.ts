"use client";

// The visitor's chosen bot, shared by every bot on the site (the home hero
// now, the assistant's avatar later). Remembered in localStorage; the server
// and the first client render use the default, and the stored one swaps in
// after hydration inside the same fixed box.

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_BOT, NO_WEAR, isBotGlasses, isBotHat, isBotType, type BotType, type BotWear } from "./bot-types";

export const BOT_STORAGE_KEY = "loakraken-bot";
/** What the bot wears (hat and glasses), kept apart from the body. */
export const WEAR_STORAGE_KEY = "loakraken-bot-wear";

const listeners = new Set<() => void>();
/** The choice when storage is blocked: kept for this page only. */
let fallback: BotType | null = null;
let fallbackWear: string | null = null;

function subscribe(callback: () => void) {
  listeners.add(callback);
  // Another tab choosing.
  const onStorage = (event: StorageEvent) => {
    if (event.key === BOT_STORAGE_KEY || event.key === WEAR_STORAGE_KEY) callback();
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

/** The wear as one string ("hat glasses"): a stable snapshot for the store. */
function readWear(): string {
  try {
    const [hat, glasses] = (localStorage.getItem(WEAR_STORAGE_KEY) ?? "").split(" ");
    return `${isBotHat(hat) ? hat : NO_WEAR.hat} ${isBotGlasses(glasses) ? glasses : NO_WEAR.glasses}`;
  } catch {
    return `${NO_WEAR.hat} ${NO_WEAR.glasses}`;
  }
}

export function chooseWear(wear: BotWear) {
  const value = `${wear.hat} ${wear.glasses}`;
  try {
    if (wear.hat === NO_WEAR.hat && wear.glasses === NO_WEAR.glasses) localStorage.removeItem(WEAR_STORAGE_KEY);
    else localStorage.setItem(WEAR_STORAGE_KEY, value);
  } catch {
    fallbackWear = value;
  }
  listeners.forEach((listener) => listener());
}

export function useChosenWear(): [BotWear, (wear: BotWear) => void] {
  const value = useSyncExternalStore(subscribe, () => fallbackWear ?? readWear(), () => `${NO_WEAR.hat} ${NO_WEAR.glasses}`);
  const wear = useMemo(() => {
    const [hat, glasses] = value.split(" ");
    return { hat: isBotHat(hat) ? hat : NO_WEAR.hat, glasses: isBotGlasses(glasses) ? glasses : NO_WEAR.glasses };
  }, [value]);
  return [wear, chooseWear];
}
