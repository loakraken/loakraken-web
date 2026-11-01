"use client";

// Motion state shared by the landing parts, without motion/react: the home
// hero uses it on its own (route budget), /about wraps it in LazyMotion.

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { MOTION_STORAGE_KEY } from "@/components/ui/theme-toggle";

/**
 * enabled: one-shot motion (entrances, transitions) may play.
 * looping: repeating motion (the hero bot, border beam, looping CSS) may play. It keeps
 * moving (user, 20:58 — replaces the 10:57 five-second stop); pressing the bot
 * pauses and resumes it (WCAG 2.2.2), and that choice is remembered. It also
 * rests while the tab is hidden, and each part pauses itself off screen.
 * Reduced motion: never.
 * paused / togglePaused: the remembered choice, set on <html> as
 * data-motion-paused before the first paint (themeInitScript), so a paused
 * page does not move for a moment before hydration.
 */
const MotionContext = createContext({ enabled: false, looping: false, paused: false, togglePaused: () => {} });
const subscribe = (callback: () => void) => {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
};
const getVisible = () => document.visibilityState === "visible";
const getServerVisible = () => false;
const subscribeReducedMotion = (callback: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getServerReducedMotion = () => true;

const pauseListeners = new Set<() => void>();
const subscribePaused = (callback: () => void) => {
  pauseListeners.add(callback);
  // Another tab pausing or resuming.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== MOTION_STORAGE_KEY) return;
    setPausedAttribute(event.newValue === "paused");
    callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    pauseListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
};
const getPaused = () => document.documentElement.hasAttribute("data-motion-paused");
const getServerPaused = () => false;
function setPausedAttribute(paused: boolean) {
  document.documentElement.toggleAttribute("data-motion-paused", paused);
}
function togglePaused() {
  const paused = !getPaused();
  setPausedAttribute(paused);
  try {
    if (paused) localStorage.setItem(MOTION_STORAGE_KEY, "paused");
    else localStorage.removeItem(MOTION_STORAGE_KEY);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  pauseListeners.forEach((listener) => listener());
}

export function MotionScope({ children }: { children: ReactNode }) {
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
  const visible = useSyncExternalStore(subscribe, getVisible, getServerVisible);
  const paused = useSyncExternalStore(subscribePaused, getPaused, getServerPaused);
  const enabled = !reduced && visible;
  const looping = enabled && !paused;
  return (
    <MotionContext.Provider value={{ enabled, looping, paused, togglePaused }}>
      <div data-motion={enabled ? "on" : "off"} data-loop={looping ? "on" : "off"}>{children}</div>
    </MotionContext.Provider>
  );
}

export const useLandingMotion = () => useContext(MotionContext);

/** Whether the user asked for reduced motion (false on the server). */
export const useReducedMotion = () => useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

/** Whether the element is on screen (margin in px), without motion/react. */
export function useVisible(ref: RefObject<Element | null>, margin = 0) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: `${margin}px` });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin]);
  return visible;
}
