"use client";

import { useSyncExternalStore } from "react";
import { countdown } from "@/lib/home/model";

/*
 * Clocks, null during SSR so time-dependent text renders after hydration.
 * Only countdown leaves tick every second; everything else ticks per minute,
 * so the dashboard does not re-render once a second.
 */
const subscribers = new Map<number, (callback: () => void) => () => void>();
const subscribeEvery = (step: number) => {
  let subscribe = subscribers.get(step);
  if (!subscribe) {
    subscribe = (callback) => {
      const id = setInterval(callback, step);
      return () => clearInterval(id);
    };
    subscribers.set(step, subscribe);
  }
  return subscribe;
};
export const useClock = (step: number) =>
  useSyncExternalStore(
    subscribeEvery(step),
    () => Math.floor(Date.now() / step) * step,
    () => null,
  );
export const SECOND = 1000;
export const MINUTE = 60_000;

/** Seconds countdown; until the client clock starts it uses the board clock
 *  (server render time), so the header text is already there (CLS). */
export function Countdown({ to, fallback }: { to: string; fallback: number | null }) {
  const now = useClock(SECOND) ?? fallback;
  if (now === null) return null;
  return <b>{countdown(to, now) ?? "곧 시작"}</b>;
}
