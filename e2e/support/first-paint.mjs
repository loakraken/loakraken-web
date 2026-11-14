// First-paint helpers shared by the specs: the first HTML can arrive cut anywhere (a split stream),
// and every box on the first screen must already have its final size and place from its start tag.

/**
 * Cut after every start tag and every text node inside `root` (first screen, nodes the server HTML holds),
 * append the rest back in page order, and report what moved. `rootSelector` is "selector|text it contains"
 * (or null for the page); `countIn` limits what counts to the root's parts matching that selector.
 */
export const cutEverywhere = (page, rootSelector, countIn = null, { serverHtml = true } = {}) =>
  page.evaluate(async ([rootSelector, countIn, serverHtml]) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const box = (r) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    const label = (n) => {
      if (!n) return "::pseudo";
      if (n.nodeType === 3) return `#text '${n.textContent.trim().slice(0, 12)}'`;
      if (n.nodeType !== 1) return n.nodeName;
      return `${n.tagName.toLowerCase()} '${(n.textContent || "").trim().slice(0, 14)}'`;
    };
    // The cuts run on a copy of the page, never on the nodes React holds: React may commit during the probe
    // (a late hydration, a query answer, a clock tick), and on moved nodes that broke ('removeChild … not a
    // child', React #418 hydration mismatch — CI flakes of the market and loading sweeps). First wait until
    // React has claimed <body> (its first hydration pass is done), then put a deep copy of <body> in its place;
    // React's later updates land on the untouched original, which comes back when the probe ends.
    const claimed = () => Object.keys(document.body).some((key) => key.startsWith("__reactFiber$"));
    // At most 5 s, well under the 8 s the loading-screen mock ('로딩긴') answers in: a page that never hydrates
    // fails as "page not hydrated" while the screen it was meant to cut is still there (codex #1622 P3).
    for (let tries = 0; !claimed() && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 50));
    if (!claimed()) return { probed: 0, value: 0, moved: ["page not hydrated"] };
    const live = document.body;
    const copy = live.cloneNode(true);
    document.documentElement.replaceChild(copy, live);
    try {
      // Each picture decodes or gives up after 2 s: a lazy picture below the screen never decodes and must
      // not hold the probe (codex #1622 P2).
      const settle = (img) =>
        Promise.race([img.decode().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 2000))]);
      await Promise.all([...copy.querySelectorAll("img")].map(settle));
      await frame();
      return await probe();
    } finally {
      document.documentElement.replaceChild(live, document.body);
    }

    async function probe() {
    const root = rootSelector
      ? [...document.querySelectorAll(rootSelector.split("|")[0])].find((el) => el.textContent.includes(rootSelector.split("|")[1]))
      : document.body;
    if (!root) return { probed: 0, value: 0, moved: ["root not found"] };
    // Counting only parts that are not there would pass on nothing: say so instead.
    if (countIn && !root.querySelector(countIn)) return { probed: 0, value: 0, moved: [`countIn not found: ${countIn}`] };
    // A list below the first screen (phones) is brought into view: only what is on screen can move.
    if (root !== document.body) {
      root.scrollIntoView({ block: "start" });
      await frame();
    }
    // Only what the first HTML holds can arrive in parts: a node drawn by the client alone (the hero's Ctrl K,
    // put in after the page wakes) comes whole, after the rest. So the cut points are the server HTML's nodes.
    const sign = (n) =>
      n.nodeType === 3
        ? `#text|${n.parentElement?.tagName}|${n.parentElement?.getAttribute("class") ?? ""}|${n.textContent.trim()}`
        : `${n.tagName}|${n.getAttribute("class") ?? ""}|${(n.textContent || "").trim().slice(0, 60)}`;
    // serverHtml false: every node counts (a screen that is gone by the time its address answers again,
    // such as a loading screen, cannot be compared with a second fetch of the page).
    const server = new DOMParser().parseFromString(serverHtml ? await (await fetch(location.href)).text() : "", "text/html");
    const known = new Set();
    const serverWalker = server.createTreeWalker(server.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = serverWalker.nextNode(); n; n = serverWalker.nextNode()) known.add(sign(n));
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 3 && !n.textContent.trim()) continue;
      if (serverHtml && !known.has(sign(n))) continue;
      const el = n.nodeType === 1 ? n : n.parentElement;
      if (!el || el.closest("svg,script,style,canvas")) continue;
      const r = el.getBoundingClientRect();
      if (r.top > innerHeight || r.bottom < 0 || r.width === 0) continue;
      nodes.push(n);
    }
    let value = 0;
    const moved = [];
    for (const n of nodes) {
      if (!n.isConnected) continue;
      const kids = n.nodeType === 1 ? [...n.childNodes] : [];
      const after = [];
      for (let node = n; node && node !== document.body; node = node.parentNode) {
        const siblings = [];
        for (let next = node.nextSibling; next; next = next.nextSibling) siblings.push(next);
        after.push([node.parentNode, siblings]);
      }
      for (const kid of kids) kid.remove();
      for (const [, siblings] of after) for (const s of siblings) s.remove();
      await frame();
      const entries = [];
      const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({ type: "layout-shift" });
      if (n.nodeType === 1) n.append(...kids);
      await frame();
      for (const [parent, siblings] of after) parent.append(...siblings);
      await frame();
      await frame();
      entries.push(...observer.takeRecords());
      observer.disconnect();
      // With a root other than the page, only what moved inside it counts: a clock elsewhere on the page
      // ('마지막 갱신 10초 전' ticking to 11초) is not a cut's doing.
      const inRoot = (source) => {
        // countIn: only what moved inside these parts of the root counts (a hero's head, not the list it holds).
        if (countIn) {
          const el = source.node && (source.node.nodeType === 1 ? source.node : source.node.parentElement);
          return !!el && root.contains(el) && !!el.closest(countIn);
        }
        if (root === document.body) return true;
        if (source.node) return root.contains(source.node);
        const r = root.getBoundingClientRect();
        const c = source.currentRect;
        return c.x >= r.left - 8 && c.right <= r.right + 8 && c.y >= r.top - 8 && c.bottom <= r.bottom + 8;
      };
      const v = entries.filter((entry) => entry.sources.some(inRoot)).reduce((sum, entry) => sum + entry.value, 0);
      if (v > 0) {
        value += v;
        moved.push(
          `${label(n)} 뒤 → ` +
            [...new Set(entries.flatMap((e) => e.sources.map((s) => `${label(s.node)} ${box(s.previousRect)}→${box(s.currentRect)}`)))].slice(0, 3).join(" | "),
        );
      }
    }
    return { probed: nodes.length, value: +value.toFixed(7), moved };
    }
  }, [rootSelector, countIn, serverHtml]);
