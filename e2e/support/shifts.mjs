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
        // What the page was like when the shift was seen, so a rare CI shift says which kind it was (material-quote
        // @320 11-19: 1px, before waking, not reproduced by fonts, cuts, late CSS or scrollbars): how far the HTML
        // had got (readyState, elements in main so far; shiftsSince adds the final count), the fonts (status and
        // the families loaded), the stylesheets, the window, and the largest raw (unrounded) move. Read when the
        // observer runs, a moment after the shift itself (seen = that moment). A read that throws must never drop the
        // shift itself (a lost entry is a silent pass) nor reach the page as an error: it records why instead
        // (PM-프론트 #1774 P3). win = the layout width (without a scrollbar) / the window's width x its height.
        let ctx;
        try {
          ctx = {
            seen: Math.round(performance.now()),
            ready: document.readyState,
            nodes: document.querySelectorAll("main *").length,
            fonts: `${document.fonts.status}:${[...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))].join("+") || "-"}`,
            sheets: document.styleSheets.length,
            win: `${document.documentElement.clientWidth}/${innerWidth}x${innerHeight}`,
            raw: +Math.max(0, ...moves.filter(Number.isFinite)).toFixed(3),
          };
        } catch (error) {
          ctx = { error: String(error?.message ?? error).slice(0, 80) };
        }
        window.__shiftLog.push({ t: entry.startTime, v: entry.value, input: entry.hadRecentInput, sources, boxes, moves, ctx });
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
  const { entries, hydratedAt, nodes } = await page.evaluate(
    (from) => ({
      entries: window.__shiftLog.filter((entry) => entry.t >= from),
      hydratedAt: window.__hydratedAt ?? null,
      nodes: document.querySelectorAll("main *").length,
    }),
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
    moved: [
      ...new Set(
        entries.map((entry) => {
          const what = [...new Set(entry.boxes ?? entry.sources)].join(", ");
          const c = entry.ctx;
          // e.g. "(152ms, 깨기 64ms 전; 본 때 153ms, loading, main 41/120, 글꼴 loading:-, 시트 6, 창 320x800, 실제 0.91px)"
          const page = !c
            ? ""
            : c.error
              ? `; 상태 읽기 실패: ${c.error}`
              : `; 본 때 ${c.seen}ms, ${c.ready}, main ${c.nodes}/${nodes}, 글꼴 ${c.fonts}, 시트 ${c.sheets}, 창 ${c.win}, 실제 ${c.raw}px`;
          return `${what} (${when(entry.t)}${page})`;
        }),
      ),
    ].join(", "),
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
