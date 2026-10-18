"use client";

import { useSyncExternalStore } from "react";
import { MINUTE, SECOND, clampNow, remainingStep, remainingText } from "@/lib/time/remaining";

/*
 * Clocks, null during SSR so time-dependent text renders after hydration.
 * Only time left under an hour ticks every second; everything else ticks per
 * minute, so the dashboard does not re-render once a second.
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
export { MINUTE, SECOND };

/** The minute clock for rows that depend on the time, never before `renderedAt` (clampNow). */
export const useNow = (renderedAt: number | null | undefined) => clampNow(useClock(MINUTE), renderedAt);

/**
 * Time left until `to` in the shared format (lib/time/remaining): a minute
 * clock while an hour or more is left, a second clock under that. Until the
 * client clock starts it uses `fallback` (server render time), so the text is
 * already in the first HTML (CLS). The client clock never goes back before it
 * (clampNow): the minute clock reads 05:38:40 as 05:38:00, which turned the
 * server's "3시간 21분" into "3시간 22분" right after hydration and moved the
 * row when the digits' widths differed (A6 on /schedule, #902). undefined
 * without any clock, null once passed.
 */
export function useRemaining(to: number | string, fallback: number | null) {
  const target = typeof to === "number" ? to : Date.parse(to);
  const minute = clampNow(useClock(MINUTE), fallback);
  const now = clampNow(useClock(minute === null ? MINUTE : remainingStep(target - minute)), fallback);
  return now === null ? undefined : remainingText(target - now);
}

/** A round countdown: the time left, "곧 시작" once it is due. */
export function Countdown({ to, fallback }: { to: string; fallback: number | null }) {
  const left = useRemaining(to, fallback);
  if (left === undefined) return null;
  return <b>{left ?? "곧 시작"}</b>;
}
