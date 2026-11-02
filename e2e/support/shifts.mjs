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
        window.__shiftLog.push({ t: entry.startTime, v: entry.value, input: entry.hadRecentInput, sources, boxes });
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
 * Runs `act`, waits `settle` ms for answers to land, and returns the shifts it
 * caused (see shiftsSince). watchShifts must have run before the page loaded.
 */
export async function shiftsDuring(page, act, settle = 1200) {
  const mark = await shiftMark(page);
  await act();
  await page.waitForTimeout(settle);
  return shiftsSince(page, mark);
}
