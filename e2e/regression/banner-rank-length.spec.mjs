// 회귀(A37·A6, PM 총괄 11-16): 배너 순위 배지는 두 덩이([티어 순위]와 [상위 비율])를 브라우저가 맞춘다. 한 줄에
// 들어가면 한 줄, 아니면 두 줄(티어 길이·순위 자릿수·글꼴·너비와 상관없이). 첫 HTML에 순위가 있던 줄만 높이가
// 늘고(사이트 글꼴은 display:optional이라 첫 그림 뒤 글꼴이 바뀌지 않음), 첫 HTML에 순위가 없던 줄은 한 줄
// 그대로 두고 늦게 온 순위가 안 맞으면 '상위'를 그리지 않는다(이름에는 남음). 어느 경우에도 배너가 움직이지 않고,
// 너비를 바꿔 줄 수가 바뀌면 배지 높이만 바뀐다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { drawnFace } from "../support/fonts.mjs";

const WIDE = `
  @font-face { font-family: "WideFallback"; src: local("DejaVu Sans"), local("DejaVuSans"), local("Verdana"); font-weight: 400; }
  @font-face { font-family: "WideFallback"; src: local("DejaVu Sans Bold"), local("DejaVuSans-Bold"), local("Verdana Bold"), local("Verdana-Bold"); font-weight: 700; }
  html, body, body * { font-family: "WideFallback", "Malgun Gothic", "Noto Sans CJK KR", "WenQuanYi Zen Hei", sans-serif !important; }`;

const rowOf = (page, who) => page.getByRole("region", { name: `${who} 캐릭터 요약` }).locator("p[class*=bannerRank]");

/** The site font in the cache, so the next page draws with it inside its short wait. */
const warmSiteFont = async (page) => {
  await gotoReady(page, "/");
  await page.evaluate(() => Promise.all([document.fonts.load("12px kraken"), document.fonts.load("700 12px kraken")]));
};

/** Pin the face: "site" (warmed and asserted), "matched" (site font blocked, matched fallback asserted). */
const useFace = async (page, face) => {
  if (face === "site") await warmSiteFont(page);
  else await page.route(/\.woff2(\?|$)/, (route) => route.abort());
};

/** Every frame's row box from the first paint, whether the badge was in it, and the badge's own box. */
const recordRowFrames = (page) =>
  page.addInitScript(() => {
    window.__rowFrames = [];
    const sample = () => {
      const row = document.querySelector('[aria-label$="캐릭터 요약"] p[class*=bannerRank]');
      if (row) {
        const r = row.getBoundingClientRect();
        const b = row.querySelector("button")?.getBoundingClientRect();
        if (r.width > 0 && r.height > 0)
          window.__rowFrames.push({
            x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, loaded: !!b,
            ...(b && { bx: b.x + scrollX, bwidth: b.width, bheight: b.height }),
          });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

/**
 * The row never moves or resizes from the first paint. With `badge`, the badge's own box (left, width, height)
 * also stays the same from its first drawn frame: the pill does not jump when the line count is fixed after
 * hydration (PM-프론트 #1759 P2). Leave it out where the badge's words change on purpose.
 */
const expectSteadyRow = async (page, { badge = false } = {}) => {
  const frames = await page.evaluate(() => window.__rowFrames);
  expect(frames.some((f) => f.loaded), "순위가 그려진 그림").toBe(true);
  for (const key of ["x", "y", "width", "height"]) {
    const drift = Math.max(...frames.map((f) => Math.abs(f[key] - frames[0][key])));
    expect(drift, `순위 줄 ${key} 변화(px)`).toBe(0);
  }
  if (badge) {
    const drawn = frames.filter((f) => f.loaded);
    for (const key of ["bx", "bwidth", "bheight"]) {
      const values = drawn.map((f) => Math.round(f[key] * 10) / 10);
      expect(Math.max(...values) - Math.min(...values), `배지 ${key} 변화(px): ${[...new Set(values)].join(" → ")}`).toBe(0);
    }
  }
  return frames;
};

/**
 * The badge in its row: drawn text past the row (px), the number of text lines, the row's height, whether the
 * one-line form fits the row (both halves and the gap within the badge's text room), and whether 상위 is drawn.
 */
const measure = (row) =>
  row.evaluate((el) => {
    const rowBox = el.getBoundingClientRect();
    const badge = el.querySelector("button");
    const halves = badge.querySelector("[class*=bannerRankHalves]");
    const [first, second] = halves.children;
    const cs = getComputedStyle(badge);
    const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const gap = second ? parseFloat(getComputedStyle(second).marginLeft) : 0;
    const oneLine = first.getBoundingClientRect().width + (second ? gap + second.getBoundingClientRect().width : 0);
    const tops = new Set();
    let over = 0;
    const walker = document.createTreeWalker(halves, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 1) continue;
        tops.add(Math.round(r.top));
        over = Math.max(over, rowBox.left - r.left, r.right - rowBox.right);
      }
    }
    const top = halves.querySelector("[class*=bannerRankTopWord]");
    return {
      over, lines: tops.size, height: rowBox.height, fits: oneLine <= room + 0.5, oneLine, room,
      topWord: !!top && top.getBoundingClientRect().width > 0,
    };
  });

const TIERS = ["크라켄", "해구", "심해", "대양", "연안", null];
const RANKS = ["7위", "47위", "412위", "4,120위", "41,203위", "412,035위"];
const SHARES = ["47%", "47.6%", "47.62%"];

test.describe("배너 순위 맞춤: 티어 × 자릿수 × 비율 꼴 @A37 @regression", () => {
  test.use({ allowConsoleErrors: true });
  for (const face of ["site", "matched"])
    for (const width of [320, 360, 390])
      test(`${width}px ${face === "site" ? "사이트 글꼴" : "맞춘 대체 글꼴"}: 들어가면 한 줄, 아니면 두 줄, 줄 밖으로 나가지 않는다`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await useFace(page, face);
        await gotoReady(page, characterPath("상세"));
        expect(await drawnFace(page), "그리는 글꼴").toBe(face);
        const row = rowOf(page, "상세");
        // The real badge first: its name is what is shown, then what is not (WCAG 2.5.3).
        const badge = row.getByRole("button", { name: /^대양 4,120위 · 상위 22\.6% 전투력 순위, .*공식 순위가 아니에요\.$/ });
        await expect(badge).toBeVisible();
        const bad = [];
        for (const tier of TIERS)
          for (const rank of RANKS)
            for (const share of SHARES) {
              // The same badge with other words: tier, rank and share swapped in place (layout as drawn).
              await row.evaluate((el, [tier, rank, share]) => {
                // The browser's own fit, as at a first paint: the row after it keeps its line count, so the
                // grid lets it wrap again (height and wrapping as the first paint has them).
                Object.assign(el.style, { height: "auto", minHeight: "26px" });
                el.querySelector("[class*=bannerRankHalves]").style.flexWrap = "wrap";
                const [first, second] = el.querySelector("[class*=bannerRankHalves]").children;
                const b = first.querySelector("b");
                b.style.display = tier ? "" : "none";
                b.textContent = tier ? `${tier} ` : "";
                first.lastChild.textContent = rank;
                second.lastChild.textContent = share;
              }, [tier, rank, share]);
              const m = await measure(row);
              const label = `${tier ?? "(티어 없음)"} ${rank} · 상위 ${share}`;
              if (m.over > 0.5) bad.push(`${label}: 줄 밖 ${m.over.toFixed(1)}px`);
              // Within half a pixel of the room the browser's rounding decides; not asserted there.
              if (Math.abs(m.oneLine - m.room) > 0.5 && m.lines !== (m.fits ? 1 : 2)) bad.push(`${label}: ${m.lines}줄 (한 줄 폭 ${m.oneLine.toFixed(1)} / 자리 ${m.room.toFixed(1)})`);
              if (!m.topWord) bad.push(`${label}: '상위'가 그려지지 않음`);
            }
        expect(bad, "배지 맞춤").toEqual([]);
      });
});

test.describe("배너 순위 맞춤: 첫 그림·늦게 온 순위·너비 바꿈 @A6 @A37 @regression", () => {
  // The matched-fallback case blocks the font files (their failed requests log by design).
  test.use({ reducedMotion: "reduce", allowConsoleErrors: true });

  for (const face of ["site", "matched"])
  for (const width of [320, 360])
    test(`${width}px ${face === "site" ? "사이트 글꼴" : "맞춘 대체 글꼴"}: 안 맞는 6자리 순위는 첫 그림부터 두 줄, 배지도 움직이지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await useFace(page, face);
      await recordRowFrames(page);
      await gotoReady(page, characterPath("순위큰수"));
      expect(await drawnFace(page), "그리는 글꼴").toBe(face);
      const row = rowOf(page, "순위큰수");
      await expect(row.getByRole("button", { name: /^연안 123,456위 · 상위 49\.98% 전투력 순위, / })).toBeVisible();
      const m = await measure(row);
      expect(m.fits, "한 줄로는 안 들어감").toBe(false);
      expect(m.lines, "두 줄").toBe(2);
      expect(m.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0.5);
      // The row and the pill itself, from the first paint through hydration (when the line count is fixed).
      const frames = await expectSteadyRow(page, { badge: true });
      expect(frames[0].height, "첫 그림부터 두 줄 높이").toBe(m.height);
      expect(m.height).toBeGreaterThan(26);
      // The two-line badge keeps a 44px press area each way (hit-44 rule on phones).
      const hit = await row.locator("button").evaluate((b) => {
        const after = getComputedStyle(b, "::after");
        return [parseFloat(after.width), parseFloat(after.height)];
      });
      expect(Math.min(...hit), "누르는 영역(px)").toBeGreaterThanOrEqual(44);
    });

  for (const [width, full] of [[320, false], [360, false], [390, true]])
    test(`${width}px: 첫 그림 뒤에 온 6자리 순위는 한 줄 자리에 ${full ? "전체" : "'상위' 없이"}, 배너가 움직이지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await warmSiteFont(page);
      await recordRowFrames(page);
      // The mock answers after the page's 1s wait: the first HTML has the empty one-line row.
      await page.goto(characterPath("순위큰수늦음"), { waitUntil: "domcontentloaded" });
      const row = rowOf(page, "순위큰수늦음");
      const name = full ? /^연안 123,456위 · 상위 49\.98% 전투력 순위, / : /^연안 123,456위 · 49\.98% 연안 전투력 123,456위 · 상위 49\.98%, /;
      const badge = row.getByRole("button", { name });
      await expect(badge).toBeVisible({ timeout: 10_000 });
      expect(await drawnFace(page), "그리는 글꼴").toBe("site");
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const m = await measure(row);
      expect(m.lines, "한 줄").toBe(1);
      expect(m.height, "줄 높이").toBe(26);
      expect(m.topWord, "'상위'를 그림").toBe(full);
      expect(m.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0.5);
      const frames = await expectSteadyRow(page, { badge: true });
      expect(frames.some((f) => !f.loaded), "순위 전 빈 줄로 먼저 그림").toBe(true);
    });

  test("너비를 바꿔 한 줄 ↔ 두 줄이 되면 배지 높이만 바뀌고 아래 글자는 그만큼만 내려간다", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await warmSiteFont(page);
    await gotoReady(page, characterPath("순위큰수"));
    const row = rowOf(page, "순위큰수");
    await expect(row.getByRole("button")).toBeVisible();
    // Find the width where it wraps (one line at w, two at w - 1).
    let w = 400;
    for (; w > 320; w--) {
      await page.setViewportSize({ width: w - 1, height: 900 });
      if ((await measure(row)).lines === 2) break;
    }
    expect(w, "줄이 바뀌는 너비").toBeGreaterThan(320);
    // Every box in the banner's left column, at w (one line) and w - 1 (two lines).
    const boxes = () =>
      page.getByRole("region", { name: "순위큰수 캐릭터 요약" }).evaluate((region) => {
        const rank = region.querySelector("p[class*=bannerRank]");
        const column = rank.parentElement;
        // Drawn boxes only (a <template> or a display:none part has none).
        return [...column.children].filter((el) => el.getClientRects().length > 0).map((el) => {
          const r = el.getBoundingClientRect();
          return { el: el === rank ? "rank" : `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`, top: r.top, height: r.height, rank: el === rank };
        });
      });
    await page.setViewportSize({ width: w, height: 900 });
    expect((await measure(row)).lines).toBe(1);
    const one = await boxes();
    await page.setViewportSize({ width: w - 1, height: 900 });
    expect((await measure(row)).lines).toBe(2);
    const two = await boxes();
    const at = one.findIndex((b) => b.rank);
    const delta = two[at].height - one[at].height;
    expect(delta, "배지 줄 높이 차").toBeGreaterThan(0);
    for (let i = 0; i < one.length; i++) {
      if (i === at) continue;
      const expected = i < at ? 0 : delta;
      expect(Math.abs(two[i].top - one[i].top - expected), `${one[i].el}: 위치 변화가 배지 높이 차 외에 없음`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(two[i].height - one[i].height), `${one[i].el}: 높이 그대로`).toBeLessThanOrEqual(0.5);
    }
  });
});

/** The words drawn past the badge's text box (the halves clipped there), in px. */
const clipped = (row) =>
  row.evaluate((el) => {
    const halves = el.querySelector("[class*=bannerRankHalves]");
    return halves.scrollWidth - halves.clientWidth;
  });

test.describe("배너 순위 맞춤: 첫 그림 뒤 줄 수 그대로, 짧은 꼴 @A6 @A37 @regression", () => {
  test.use({ reducedMotion: "reduce" });

  test("320px 넓은 시스템 글꼴: 늦게 온 6자리 순위가 한 줄 자리에 잘린 글자 없이(티어까지 빼서) 들어간다", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.addInitScript((css) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }, WIDE);
    await recordRowFrames(page);
    await page.goto(characterPath("순위큰수늦음"), { waitUntil: "domcontentloaded" });
    const row = rowOf(page, "순위큰수늦음");
    // Shown as far as it fits; the name says the full rank, tier included.
    const badge = row.getByRole("button", { name: /^.*49\.98% 연안 전투력 123,456위 · 상위 49\.98%, / });
    await expect(badge).toBeVisible({ timeout: 10_000 });
    const used = await page.evaluate(() =>
      [...document.fonts].some((f) => f.family.replace(/"/g, "") === "WideFallback" && f.status === "loaded"),
    );
    expect(used, "넓은 대체 글꼴(DejaVu Sans·Verdana)이 실제로 쓰였다").toBe(true);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const m = await measure(row);
    expect(m.lines, "한 줄").toBe(1);
    expect(m.height, "줄 높이").toBe(26);
    expect(await clipped(row), "잘린 글자(px)").toBeLessThanOrEqual(0.5);
    expect(m.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0.5);
    await expectSteadyRow(page);
  });

  // The rank asked again later (here a tab switch: the page asks the server again) comes back another length.
  for (const [who, before, after, lines, height] of [
    ["순위바뀜", /^대양 4,120위 · 상위 22\.6% 전투력 순위, /, /123,456위.* 전투력 123,456위 · 상위 49\.98%, /, 1, 26],
    ["순위줄어듦", /^연안 123,456위 · 상위 49\.98% 전투력 순위, /, /^대양 4,120위 · 상위 22\.6% 전투력 순위, /, 2, 42],
  ])
    test(`360px ${who}: 다시 받은 순위의 길이가 달라도 첫 그림의 ${lines}줄 그대로, 배너가 움직이지 않는다`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 360, height: 900 });
      await warmSiteFont(page);
      await recordRowFrames(page);
      // Its own name: the mock counts the asks per name.
      const name = `${who}${testInfo.workerIndex}${testInfo.retry}${testInfo.repeatEachIndex}${Date.now()}`;
      await gotoReady(page, characterPath(name));
      const row = rowOf(page, name);
      await expect(row.getByRole("button", { name: before })).toBeVisible();
      expect((await measure(row)).lines, "첫 그림").toBe(lines);
      await page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name: "스킬", exact: true }).click();
      await expect(row.getByRole("button", { name: after })).toBeVisible({ timeout: 10_000 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const m = await measure(row);
      expect(m.lines, "줄 수 그대로").toBe(lines);
      expect(m.height, "줄 높이 그대로").toBe(height);
      expect(await clipped(row), "잘린 글자(px)").toBeLessThanOrEqual(0.5);
      expect(m.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0.5);
      const frames = await expectSteadyRow(page);
      expect(frames[0].height).toBe(height);
    });
});

test.describe("배너 순위 맞춤: 넓은 글꼴·긴 값 @A37 @regression", () => {
  test.use({ allowConsoleErrors: true, reducedMotion: "reduce" });

  for (const [width, theme] of [[320, "dark"], [360, "light"], [390, "dark"]])
    test(`${width}px 넓은 시스템 글꼴(${theme}): 6자리 순위가 줄 밖으로 나가지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), theme);
      await page.addInitScript((css) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      }, WIDE);
      await gotoReady(page, characterPath("순위큰수"));
      const used = await page.evaluate(async () => {
        await Promise.all([document.fonts.load("12px WideFallback"), document.fonts.load("700 12px WideFallback")]);
        return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "WideFallback" && f.status === "loaded");
      });
      expect(used, "넓은 대체 글꼴(DejaVu Sans·Verdana)이 실제로 쓰였다").toBe(true);
      const row = rowOf(page, "순위큰수");
      await expect(row.getByRole("button")).toBeVisible();
      const m = await measure(row);
      expect(m.lines, "안 들어가면 두 줄").toBe(m.fits ? 1 : 2);
      expect(m.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0.5);
    });

  // Real pages: the longest one-line case on the longest banner (5 digits, two decimals, the longest server
  // name), and a 7-digit rank in the first HTML and late.
  for (const who of ["순위다섯자리긴값", "순위일곱자리", "순위일곱자리늦음"])
    for (const face of ["site", "matched"])
      for (const width of [320, 360, 390])
        test(`${who} ${width}px ${face === "site" ? "사이트 글꼴" : "맞춘 대체 글꼴"}: 줄 밖으로 나가지 않는다`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await useFace(page, face);
          await gotoReady(page, characterPath(who));
          expect(await drawnFace(page), "그리는 글꼴").toBe(face);
          const row = rowOf(page, who);
          await expect(row.getByRole("button")).toBeVisible({ timeout: 10_000 });
          const m = await measure(row);
          expect(m.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0.5);
          if (who.endsWith("늦음")) expect(m.lines, "늦게 온 순위는 한 줄").toBe(1);
          else expect(m.lines, "들어가면 한 줄, 아니면 두 줄").toBe(m.fits ? 1 : 2);
        });
});
