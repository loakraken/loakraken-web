// 회귀(CI run 44772043865 shard 2/6, PM 총괄 11-21 01:43, #1815를 막음): 360 지옥 · 나락 보상에서 시세가 깬 뒤 110ms에
// 오자 기본 보상 첫 품목('운명의 파편', x 11 · y 667, 237x15)이 크기 그대로 1px 아래로 내려감(0.0007). 위의 칸들이 글꼴
// 값(line-height: normal)으로 높이를 정해 소수 높이(77.16 · 41.44 · 56.59)였고, 글자나 글꼴이 바뀌면 그 소수가
// 반올림을 넘어 1px로 보였다. 로컬(Windows)에서는 그 순간을 다시 만들지 못해(시세를 1.5초 늦춰도 0, 15번 0), 그
// 조건을 없앴다: 머리 값·풍요 단추·0G 줄·품목 줄은 정한 px 줄 높이라 높이가 글자·글꼴에 따라 바뀌지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";
import { drawnFace, useUntunedSystemFace } from "../support/fonts.mjs";

// The blocks above the base list's first item and the item's own line, as the page draws them.
const blocks = (page) =>
  page.evaluate(() => {
    const main = document.querySelector("main");
    const list = main.querySelector('ul[aria-label^="기본 보상"]');
    // The stage and price-basis labels: their target is the shared Select, a button with role combobox, not a
    // native <select> (codex #1825). Their own line height must be whole px too: the 36px control can make the
    // label's box whole while its text line is not.
    const stages = [...main.querySelectorAll("label[for]")].filter((label) => {
      const target = document.getElementById(label.htmlFor);
      return target?.tagName === "SELECT" || target?.getAttribute("role") === "combobox";
    });
    const els = [
      // The section titles too (codex #1823 P3: they kept the inherited 1.43).
      ...main.querySelectorAll('h2[id^="hell-"]'),
      ...main.querySelectorAll('dl[aria-live] > div, dl[aria-live] dt, dl[aria-live] dd, label:has(> input[role="switch"])'),
      ...[...main.querySelectorAll("p")].filter((p) => p.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING && p.closest("section") === list.closest("section")),
      ...list.querySelector("li").querySelectorAll(":scope > span, strong, small"),
    ];
    const box = (el, line) => {
      const r = el.getBoundingClientRect();
      return { what: `${el.tagName.toLowerCase()} '${el.textContent.trim().slice(0, 12)}'`, h: r.height, lh: getComputedStyle(el).lineHeight, line };
    };
    return { stages: stages.length, all: [...stages.map((el) => box(el, true)), ...els.map((el) => box(el, false))] };
  });

for (const width of [360, 320])
  test(`@A7 ${width} 지옥 · 나락 보상: 기본 보상 위 칸의 줄 높이는 글자·글꼴과 상관없는 정수 px @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/tools/hell-reward");
    await expect(page.getByRole("list", { name: /^기본 보상/ })).toBeVisible();
    const { stages, all: found } = await blocks(page);
    // Both labels (단계, 시세 기준) found, so the leg cannot pass on none (codex #1825).
    expect(stages, "단계·시세 기준 칸").toBe(2);
    expect(found.length, "찾은 칸").toBeGreaterThan(10);
    const fraction = (px) => Math.abs(px - Math.round(px)) > 0.01;
    const loose = found.filter((b) => b.lh === "normal" || fraction(b.h) || (b.line && fraction(parseFloat(b.lh))));
    expect(loose.map((b) => `${b.what} h=${b.h.toFixed(2)} lh=${b.lh}`), "글꼴 값 줄 높이·소수 높이").toEqual([]);
  });

for (const face of ["site", "untuned"])
  test(`@A7 360 지옥 · 나락 보상: 시세가 깬 뒤 늦게 와도(${face}) 기본 보상이 움직이지 않는다 @regression`, async ({ page }) => {
    if (face === "untuned") {
      // Held, never answered: display: optional keeps the system face.
      await page.route(/\.woff2(\?|$)/, () => {});
      await useUntunedSystemFace(page);
    } else {
      // The site font warmed in the cache first, as the other site legs do: under display: optional a slow runner
      // can miss the face on a cold load, and the leg would fail on the font, not the shift (codex #1823 P3).
      await gotoReady(page, "/");
      await page.evaluate(() => Promise.all([document.fonts.load("12px kraken"), document.fonts.load("700 12px kraken")]));
    }
    await page.setViewportSize({ width: 360, height: 900 });
    // The late answer of the CI run: prices land after the page woke.
    await page.route("**/api/markets/material-prices", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await watchShifts(page);
    await page.goto("/tools/hell-reward", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/^시세 (방금|\d+분 전) 수집$/)).toBeVisible({ timeout: 10_000 });
    // The face the leg names is the one drawn (a site font slipping through would test the site face twice).
    if (face === "site") await page.evaluate(() => document.fonts.ready);
    expect(await drawnFace(page)).toBe(face);
    await page.waitForTimeout(600);
    const late = await shiftsSince(page);
    expect(late.all, `늦은 시세 흔들림 (${late.moved})`).toBe(0);
  });
