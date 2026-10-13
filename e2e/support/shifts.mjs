// Layout-shift measurement shared by the e2e specs.
//
// Checklist A7 ("조작 중 흔들림 0") counts every layout shift while a control
// is used, including the ones the browser flags hadRecentInput (within 0.5s
// of a click or key). The CLS metric leaves those out, which is why a page
// change that shrank a table went unnoticed: use `all` for A7, `quiet` only
// where something may legitimately move right after input (content that opens
// below the pressed control).

/** Starts recording layout shifts from the very start of every page load. */
export async function watchShifts(page) {
  await page.addInitScript(() => {
    window.__shiftLog = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const sources = (entry.sources ?? []).map((source) => {
          const node = source.node;
          if (!node) return "?";
          const el = node.nodeType === 1 ? node : node.parentElement;
          const name = el ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.split(" ")[0]}` : ""}` : "?";
          return node.nodeType === 3 ? `${name}>#text` : name;
        });
        window.__shiftLog.push({ t: entry.startTime, v: entry.value, input: entry.hadRecentInput, sources });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** A point in time to measure from (the page's own clock). */
export const shiftMark = (page) => page.evaluate(() => performance.now());

/**
 * Shifts since `mark` (or since the page started): `all` (A7), `input` (right
 * after a click or key), `quiet` (no recent input, as CLS counts) and the
 * elements that moved, for the failure message.
 */
export async function shiftsSince(page, mark = 0) {
  const entries = await page.evaluate((from) => window.__shiftLog.filter((entry) => entry.t >= from), mark);
  const sum = (list) => +list.reduce((total, entry) => total + entry.v, 0).toFixed(4);
  return {
    all: sum(entries),
    input: sum(entries.filter((entry) => entry.input)),
    quiet: sum(entries.filter((entry) => !entry.input)),
    moved: [...new Set(entries.flatMap((entry) => entry.sources))].join(", "),
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
