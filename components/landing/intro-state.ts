// Shared by the /about intro and the landing's own motion (kept tiny: the
// landing's Reveal reads it, the intro itself loads only on /about).

/** The class on <html> while the intro owns the page (set before the first paint). */
export const INTRO_CLASS = "about-intro";
/** Fired on window when the intro finished or was skipped. */
export const INTRO_END_EVENT = "loakraken:about-intro-end";
/** Played once per tab (session storage). */
export const PLAYED_KEY = "loakraken:about-intro";
/** Not claimed by the intro within this long: the finished page instead. */
const SAFETY_MS = 3000;
/**
 * On <html> once this visit of /about has been decided (by the inline script on
 * a full load, or by startIntro on a client-side one), whichever way: nothing
 * decides it again. Without it, a slow load whose safety timer had already shown
 * the finished page was hidden again at hydration and built from scratch.
 * BuildIntro removes it when /about is left.
 */
export const DECIDED_ATTR = "data-intro-decided";

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
export const aboutIntroScript = `(function(){try{var d=document.documentElement;d.setAttribute("${DECIDED_ATTR}","");if(matchMedia("(prefers-reduced-motion: reduce)").matches||d.hasAttribute("data-motion-paused")||sessionStorage.getItem("${PLAYED_KEY}"))return;d.classList.add("${INTRO_CLASS}");setTimeout(function(){if(d.hasAttribute("data-intro-claimed"))return;d.classList.remove("${INTRO_CLASS}");dispatchEvent(new Event("${INTRO_END_EVENT}"))},${SAFETY_MS})}catch(e){}})()`;

/**
 * The same decision, with the same safety timer, for a visit the inline script
 * did not see: /about opened by a client-side link (the header menu), where
 * React does not run inline scripts. BuildIntro calls it before the page is
 * first painted (useLayoutEffect). A visit the script already decided (on, off,
 * or ended by its safety timer) is left as it is. Kept equal to
 * aboutIntroScript by a unit test.
 */
export function startIntro() {
  try {
    const d = document.documentElement;
    if (d.hasAttribute(DECIDED_ATTR)) return;
    d.setAttribute(DECIDED_ATTR, "");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || d.hasAttribute("data-motion-paused") || sessionStorage.getItem(PLAYED_KEY)) return;
    d.classList.add(INTRO_CLASS);
    setTimeout(() => {
      if (d.hasAttribute("data-intro-claimed")) return;
      d.classList.remove(INTRO_CLASS);
      dispatchEvent(new Event(INTRO_END_EVENT));
    }, SAFETY_MS);
  } catch {
    // Storage blocked (or no matchMedia): the finished page, as with the script.
  }
}
