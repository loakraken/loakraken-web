// 회귀(캐릭터 화면 전수표 §14.1 ⑤): 배너 숫자 줄 아래 전투력 순위(티어·전체 순위).
// 순위 패널과 같은 조회 하나, 순위가 없으면 빈 줄(0·추정 없음), 도착해도 배너가 흔들리지 않는다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("배너 순위: 티어와 전체 전투력 순위, 공식 순위 아님 안내 @regression", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/characters/rank")) requests.push(request.url());
  });
  await gotoReady(page, characterPath("상세"));
  const banner = page.getByRole("region", { name: "상세 캐릭터 요약" });
  const badge = banner.getByRole("button", { name: /전투력 4,120위 · 상위 22\.6%/ });
  await expect(badge).toContainText("대양");
  await expect(badge).toHaveAccessibleName(/공식 순위가 아니에요/);
  // The 순위 panel on the same tab reads the same answer: never a second request.
  await expect(page.getByText("4,120위").first()).toBeVisible();
  expect(requests.length).toBeLessThanOrEqual(1);
});

test("배너 순위: 순위가 없으면 빈 줄로 자리만 @regression", async ({ page }) => {
  for (const name of ["조건밖", "미관측"]) {
    await gotoReady(page, characterPath(name));
    const banner = page.getByRole("region", { name: `${name} 캐릭터 요약` });
    await expect(banner.getByRole("button", { name: /전투력 .*위/ })).toHaveCount(0);
    await expect(banner.locator("p[class*=bannerRank]")).toHaveCount(1);
  }
});

test.describe("배너 순위: 좁은 화면의 숫자와 고정 자리 @A37 @smoke @regression", () => {
  test.use({ reducedMotion: "reduce" });

  for (const width of [320, 360, 390]) {
    for (const theme of ["light", "dark"]) {
      test(`${width}px ${theme}: 순위가 다 보이고 첫 그림부터 자리가 같다`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((theme) => {
          localStorage.setItem("loakraken-theme", theme);
          // Sample from the first painted row, before hydration can fill it.
          // Record every frame so a temporary jump cannot hide between reads.
          window.__bannerRankFrames = [];
          const sample = () => {
            const row = document.querySelector('[aria-label$="캐릭터 요약"] p[class*=bannerRank]');
            if (row) {
              const r = row.getBoundingClientRect();
              if (r.width > 0 && r.height > 0)
                window.__bannerRankFrames.push({
                  x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height,
                  loaded: !!row.querySelector("button"),
                });
            }
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }, theme);

        // This existing mock exceeds the server's 1s rank prefetch deadline,
        // leaving the reserved row empty in the first HTML. Hold its client
        // response until the empty row has actually painted.
        let releaseRank;
        const heldRank = new Promise((resolve) => { releaseRank = resolve; });
        let rankRequested = false;
        await page.route("**/api/characters/rank?**", async (route) => {
          rankRequested = true;
          await heldRank;
          await route.fallback();
        });

        try {
          await page.goto(characterPath("순위늦음"), { waitUntil: "domcontentloaded" });
          // Light is represented by an absent data-theme attribute.
          await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? "light")).toBe(theme);
          const banner = page.getByRole("region", { name: "순위늦음 캐릭터 요약" });
          const row = banner.locator("p[class*=bannerRank]");
          const badge = row.getByRole("button", { name: /전투력 4,120위 · 상위 22\.6%/ });
          await expect(row).toBeVisible();
          await expect(row.getByRole("button")).toHaveCount(0);
          await expect.poll(() => rankRequested).toBe(true);
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          releaseRank();

          await expect(badge).toBeVisible();
          await expect(badge).toContainText("대양");
          await expect(badge).toContainText("4,120위 · 상위 22.6%");
          // The badge keeps the row's type at every width (the button inherits
          // it); only its spacing tightens below 360px.
          const rowFont = await row.evaluate((el) => getComputedStyle(el).fontSize);
          await expect(badge).toHaveCSS("font-size", rowFont);
          await expect(badge).toHaveCSS("padding-left", width < 360 ? "4px" : "10px");
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

          const geometry = await row.evaluate((el) => {
            const box = el.getBoundingClientRect();
            const textRects = [];
            const clipped = [];
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (!node.textContent.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const r of range.getClientRects()) {
                if (r.width === 0) continue; // The metric label is hidden on phones.
                textRects.push({ left: r.left, right: r.right });
                for (let a = node.parentElement; a; a = a.parentElement) {
                  const style = getComputedStyle(a);
                  const ar = a.getBoundingClientRect();
                  if (
                    (style.overflowX !== "visible" && (r.left < ar.left || r.right > ar.right)) ||
                    (style.overflowY !== "visible" && (r.top < ar.top || r.bottom > ar.bottom)) ||
                    style.textOverflow === "ellipsis"
                  ) clipped.push(node.textContent.trim());
                }
              }
            }
            return {
              left: box.left, right: box.right,
              scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
              textRects, clipped,
            };
          });
          expect(geometry.textRects.length, "실제로 그려진 순위 글자").toBeGreaterThan(0);
          for (const r of geometry.textRects) {
            expect(r.left, "순위 글자 왼쪽").toBeGreaterThanOrEqual(geometry.left);
            expect(r.right, "순위 글자 오른쪽").toBeLessThanOrEqual(geometry.right);
          }
          expect(geometry.scrollWidth, "순위 줄 가로 넘침").toBeLessThanOrEqual(geometry.clientWidth);
          expect(geometry.clipped, "순위 글자 잘림·말줄임 없음").toEqual([]);

          const frames = await page.evaluate(() => window.__bannerRankFrames);
          expect(frames.some((frame) => !frame.loaded), "데이터 전 첫 그림").toBe(true);
          expect(frames.some((frame) => frame.loaded), "데이터 뒤 그림").toBe(true);
          const first = frames[0];
          for (const key of ["x", "y", "width", "height"]) {
            const drift = Math.max(...frames.map((frame) => Math.abs(frame[key] - first[key])));
            expect(drift, `순위 줄 ${key} 변화(px)`).toBe(0);
          }
        } finally {
          releaseRank();
        }
      });
    }
  }
});
