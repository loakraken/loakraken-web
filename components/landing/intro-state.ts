// Shared by the /about intro and the landing's own motion (kept tiny: the
// landing's Reveal reads it, the intro itself loads only on /about).

/** The class on <html> while the intro owns the page (set before the first paint). */
export const INTRO_CLASS = "about-intro";
/** Fired on window when the intro finished or was skipped. */
export const INTRO_END_EVENT = "loakraken:about-intro-end";
/** Played once per tab (session storage). */
export const PLAYED_KEY = "loakraken:about-intro";

const subscribe = (callback: () => void) => {
  window.addEventListener(INTRO_END_EVENT, callback);
  return () => window.removeEventListener(INTRO_END_EVENT, callback);
};
const snapshot = () => document.documentElement.classList.contains(INTRO_CLASS);
const serverSnapshot = () => false;

/** For useSyncExternalStore: is the intro running now. */
export const introStore = { subscribe, snapshot, serverSnapshot };

/**
 * Inline on /about, before the first paint (with the request's CSP nonce):
 * turns the intro on unless motion is reduced or paused, or it already played
 * in this tab. Without JS nothing is hidden. If the intro has not claimed the
 * page within 3 s (a slow or failed bundle, an error), it is turned off again:
 * the page is never left with hidden blocks.
 */
export const aboutIntroScript = `(function(){try{var d=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches||d.hasAttribute("data-motion-paused")||sessionStorage.getItem("${PLAYED_KEY}"))return;d.classList.add("${INTRO_CLASS}");setTimeout(function(){if(d.hasAttribute("data-intro-claimed"))return;d.classList.remove("${INTRO_CLASS}");dispatchEvent(new Event("${INTRO_END_EVENT}"))},3000)}catch(e){}})()`;
