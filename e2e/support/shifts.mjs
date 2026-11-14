// Layout-shift measurement shared by the e2e specs.
//
// Checklist A7 ("조작 중 흔들림 0") counts every layout shift while a control
// is used, including the ones the browser flags hadRecentInput (within 0.5s
// of a click or key). The CLS metric leaves those out, which is why a page
// change that shrank a table went unnoticed: use `all` for A7, `quiet` only
// where something may legitimately move right after input (content that opens
// below the pressed control).

/**
 * Starts recording layout shifts from the very start of every page load. Each
 * entry keeps `sources` (short names, as specs match them) and `boxes`: every
 * moved element's path (two ancestors) and its box before → after, so a rare
 * shift caught on CI says what moved where (#1333). The moment the page woke
 * (the root effect sets window.__lkHydrated, lib/early-clicks.ts) is kept too.
 */
export async function watchShifts(page) {
  await page.addInitScript(() => {
    window.__shiftLog = [];
    let hydrated;
    Object.defineProperty(window, "__lkHydrated", {
      configurable: true,
      get: () => hydrated,
      set: (value) => {
        hydrated = value;
        window.__hydratedAt ??= performance.now();
      },
    });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const label = (el) =>
          el ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.split(" ")[0]}` : ""}` : "?";
        const box = (r) => (r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` : "-");
        const path = (el) => [el?.parentElement?.parentElement, el?.parentElement, el].filter(Boolean).map(label).join(">");
        const boxes = (entry.sources ?? []).map((source) => {
          const node = source.node;
          const el = node && (node.nodeType === 1 ? node : node.parentElement);
          const name = !node ? "?" : node.nodeType === 3 ? `${path(el)}>#text` : path(el);
          return `${name} ${box(source.previousRect)}→${box(source.currentRect)}`;
        });
        const sources = (entry.sources ?? []).map((source) => {
          const node = source.node;
          if (!node) return "?";
          const el = node.nodeType === 1 ? node : node.parentElement;
          const name = label(el);
          if (node.nodeType === 3) return `${name}>#text`;
          // A pseudo-element ('::after') names its owner and how it moved, or
          // the message cannot say which of many hit areas it was.
          if (name.startsWith("::")) {
            const [a, b] = [source.previousRect, source.currentRect];
            const delta = a && b ? ` ${Math.round(a.x)},${Math.round(a.y)} ${Math.round(a.width)}x${Math.round(a.height)}→${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}` : "";
            return `${label(el.parentElement)}${name}${delta}`;
          }
          return name;
        });
        // Largest raw change of each source's box (px, unrounded), for realMoves.
        const moves = (entry.sources ?? []).map(({ previousRect: a, currentRect: b }) =>
          a && b ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) : Infinity,
        );
        window.__shiftLog.push({ t: entry.startTime, v: entry.value, input: entry.hadRecentInput, sources, boxes, moves });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** A point in time to measure from (the page's own clock). */
export const shiftMark = (page) => page.evaluate(() => performance.now());

/**
 * Shifts since `mark` (or since the page started): `all` (A7), `input` (right
 * after a click or key), `quiet` (no recent input, as CLS counts) and, for the
 * failure message, what moved: each element's path and box before → after,
 * when (ms since the page started) and how long before or after the page woke
 * ("깨기 전" if it had not woken yet).
 */
export async function shiftsSince(page, mark = 0) {
  const { entries, hydratedAt } = await page.evaluate(
    (from) => ({ entries: window.__shiftLog.filter((entry) => entry.t >= from), hydratedAt: window.__hydratedAt ?? null }),
    mark,
  );
  const sum = (list) => +list.reduce((total, entry) => total + entry.v, 0).toFixed(4);
  const when = (t) => {
    const at = `${Math.round(t)}ms`;
    if (hydratedAt === null) return `${at}, 깨기 전`;
    const since = Math.round(t - hydratedAt);
    return since < 0 ? `${at}, 깨기 ${-since}ms 전` : `${at}, 깬 뒤 ${since}ms`;
  };
  return {
    all: sum(entries),
    input: sum(entries.filter((entry) => entry.input)),
    quiet: sum(entries.filter((entry) => !entry.input)),
    moved: [...new Set(entries.flatMap((entry) => (entry.boxes ?? entry.sources).map((what) => `${what} (${when(entry.t)})`)))].join(", "),
  };
}

/**
 * Moves since `mark` that the eye can see: a box whose position or size
 * changed by 1px or more (raw, before rounding). Chrome also reports sub-pixel
 * shifts whose boxes round to the same numbers (#1443 CI: 5 such "moves");
 * those are not a move.
 */
export async function realMoves(page, mark = 0) {
  return page.evaluate(
    (from) =>
      window.__shiftLog
        .filter((entry) => entry.t >= from)
        .flatMap((entry) => entry.boxes.filter((_, i) => entry.moves[i] >= 1)),
    mark,
  );
}

/**
 * Runs `act`, waits `settle` ms for answers to land, and returns the shifts it
 * caused (see shiftsSince). watchShifts must have run before the page loaded.
 */
export async function shiftsDuring(page, act, settle = 1200) {
  const mark = await shiftMark(page);
  await act();
  await page.waitForTimeout(settle);
  return shiftsSince(page, mark);
}

/**
 * Like shiftsDuring, but returns as soon as the page is quiet instead of
 * always waiting `max` ms (the fixed wait it replaces, and still the cap).
 * Quiet means nothing that could still move a box is pending: no request in
 * flight, no timer of `max` ms or less set since the press waiting to fire
 * (a debounce, a delayed reveal), no finite animation or transition of a
 * layout property running (delay included) — and then no layout shift or DOM
 * change for `quiet` ms. So a move that comes
 * after an answer, a timer or an animation is waited for exactly as the fixed
 * wait did; only a press that has nothing left to do returns early. Something
 * that never settles (a clock, an endless shimmer) runs to `max`, as before.
 */
export async function shiftsUntilQuiet(page, act, { quiet = 400, max = 1200 } = {}) {
  const inflight = new Set();
  const start = (request) => inflight.add(request);
  const end = (request) => inflight.delete(request);
  page.on("request", start);
  page.on("requestfinished", end);
  page.on("requestfailed", end);
  // Runs in the page: watch DOM changes and short timers from now on (again in a document the press opened).
  const watch = (maxMs) => {
    window.__lkQuietObserver?.disconnect();
    window.__lkLastChange = performance.now();
    window.__lkQuietObserver = new MutationObserver(() => (window.__lkLastChange = performance.now()));
    window.__lkQuietObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    window.__lkTimers = new Set();
    if (!window.__lkTimersWrapped) {
      window.__lkTimersWrapped = true;
      const set = window.setTimeout;
      const clear = window.clearTimeout;
      window.setTimeout = function (callback, delay, ...rest) {
        if (typeof callback !== "function" || !(Number(delay) <= window.__lkTimerMax)) return set.call(this, callback, delay, ...rest);
        const id = set.call(this, (...args) => {
          window.__lkTimers?.delete(id);
          callback(...args);
        }, delay, ...rest);
        window.__lkTimers?.add(id);
        return id;
      };
      window.clearTimeout = function (id) {
        window.__lkTimers?.delete(id);
        return clear.call(this, id);
      };
    }
    window.__lkTimerMax = maxMs;
  };
  try {
    await page.evaluate(watch, max);
    const mark = await shiftMark(page);
    const began = Date.now();
    await act();
    let lastBusy = Date.now();
    while (Date.now() - began < max) {
      await page.waitForTimeout(50);
      if (inflight.size) {
        lastBusy = Date.now();
        continue;
      }
      // In the page's own clock: 0 while a timer or a finite animation is pending, else how long since the last
      // DOM change or layout shift.
      let idleFor = await page
        .evaluate(() => {
          if (window.__lkLastChange === undefined) return -1;
          if (window.__lkTimers?.size) return 0;
          // Only an animation that can still move a box holds the wait: a finite one on the document's clock that
          // animates a layout property. Scroll-driven ones (the tab rows' edge fades) "run" as long as the page
          // is open; transform, opacity and colour never make a layout shift (the podium's rolling digits).
          const free = new Set(["offset", "computedOffset", "easing", "composite", "transform", "translate", "rotate", "scale", "opacity", "filter", "color", "backgroundColor", "borderColor", "outlineColor", "boxShadow", "textShadow", "clipPath", "maskImage", "maskPosition", "maskSize", "webkitMaskImage", "webkitMaskPosition", "fill", "stroke", "strokeDashoffset", "visibility"]);
          const moves = (a) =>
            a.playState === "running" &&
            a.timeline === document.timeline &&
            a.effect?.getComputedTiming().iterations !== Infinity &&
            (a.effect?.getKeyframes?.() ?? []).some((frame) => Object.keys(frame).some((prop) => !free.has(prop)));
          if (document.getAnimations().some(moves)) return 0;
          const lastShift = window.__shiftLog?.at(-1)?.t ?? 0;
          return performance.now() - Math.max(window.__lkLastChange ?? 0, lastShift);
        })
        .catch(() => 0);
      if (idleFor === -1) {
        // A press that opened another document: watch it from now on.
        await page.evaluate(watch, max).catch(() => {});
        idleFor = 0;
      }
      if (idleFor === 0) lastBusy = Date.now();
      if (Math.min(idleFor, Date.now() - lastBusy) >= quiet) break;
    }
    return await shiftsSince(page, mark);
  } finally {
    page.off("request", start);
    page.off("requestfinished", end);
    page.off("requestfailed", end);
    await page.evaluate(() => window.__lkQuietObserver?.disconnect()).catch(() => {});
  }
}
