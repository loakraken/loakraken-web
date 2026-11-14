// 회귀(QA 11-15 04시 P2-1, PM 총괄 P1): 시세에서 분류를 그 자리에서 고른 뒤(주소만 바뀜) 다른 화면에 갔다가 뒤로
// 오면, 주소는 고른 분류(/market?tab=FOOD)인데 줄과 표는 처음 연 분류(재련 재료)였다. 그 자리 고르기는 주소를
// replaceState로 쓰고, 표는 처음 그릴 때의 서버 값만 읽었다. 이제 표는 주소를 읽어, 뒤로 · 앞으로 와도 주소가
// 말하는 분류 · 등급 · 검색어를 보여 준다(처음부터, 다른 분류가 비쳤다 바뀌지 않고). codex #1669: 그 자리에서 고르는
// 순간에도 이전 표가 한 프레임도 다시 보이지 않고(주소가 늦게 따라와도), 답이 아직 없는 분류는 이전 분류의 행 대신
// 빈 틀, 다른 분류 요청도 없다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const row = (page) => page.getByRole("navigation", { name: "시세 분류" });
const heading = (page) => page.locator("#board-heading");

/**
 * From now on, every painted frame's whole board — heading, marked category, every visible row and the freshness
 * line's height (each change once) — and every board request. A soft navigation (an in-place pick, Back, a push)
 * keeps the document, so nothing between is missed: a board that stays a while and one that comes back for a
 * single frame alike.
 */
const watchFrames = async (page) => {
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/markets/board")) requests.push(new URL(request.url()).searchParams.get("tab"));
  });
  await page.evaluate(() => {
    window.__frames = [];
    // A press starts the record anew: the frames before it are the board it leaves. (A click's update is
    // committed before the next frame is painted.)
    document.addEventListener("click", () => (window.__frames = []), { capture: true, once: true });
    const text = (el) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const sample = () => {
      const board = document.querySelector('section[aria-labelledby="board-heading"]');
      const frame = JSON.stringify({
        heading: text(document.querySelector("#board-heading")),
        current: text(document.querySelector('nav[aria-label="시세 분류"] [aria-current="page"]')),
        // Every row the board shows (none while the skeleton shows).
        rows: [...(board?.querySelectorAll("ul li button") ?? [])].map(text),
        fresh: Math.round(board?.querySelector('[class*="freshness"]')?.getBoundingClientRect().height ?? 0),
      });
      if (window.__frames.at(-1) !== frame) window.__frames.push(frame);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  return requests;
};
const framesOf = async (page) => (await page.evaluate(() => window.__frames)).map((frame) => JSON.parse(frame));
const show = (frames) => frames.map((f) => `${f.heading} | ${f.current} | ${f.rows.length}행 ${f.rows[0] ?? ""} | ${f.fresh}`).join(" → ");

/**
 * Since watchFrames, every frame that shows a board shows `label`'s: its heading, the marked category and every
 * row (the mock names other categories' items with their tab, e.g. '합성 FOOD 품목 3'); every board request was
 * for `tab`.
 */
const noWrongBoard = async (page, requests, tab, label) => {
  const frames = await framesOf(page);
  const wrong = frames.filter(
    (f) => f.heading && (!f.heading.startsWith(`${label} 시세`) || f.current !== label || f.rows.some((name) => !name.includes(tab))),
  );
  expect(wrong.length, `다른 표가 보인 프레임: ${show(frames)}`).toBe(0);
  expect(requests.filter((asked) => asked !== tab), `다른 분류 요청: ${requests.join(", ")}`).toEqual([]);
};

const expectBoard = async (page, { tab, label, grade = null }) => {
  await expect(page).toHaveURL(new RegExp(`[?&]tab=${tab}(&|$)`));
  if (grade) await expect(page).toHaveURL(new RegExp(`[?&]grade=${encodeURIComponent(grade)}(&|$)`));
  await expect(row(page).getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  await expect(heading(page)).toContainText(`${label} 시세`);
  if (grade) await expect(page.getByRole("group", { name: "등급" }).getByRole("button", { name: grade })).toHaveAttribute("aria-pressed", "true");
};

for (const width of [1280, 360])
  test.describe(`${width}: 그 자리에서 고른 분류로 뒤로 오면 주소 · 줄 · 표가 같다 @regression`, () => {
    test.beforeEach(async ({ page }) => page.setViewportSize({ width, height: 900 }));

    test("시세 → 요리 → 보석 → 뒤로 → 앞으로 → 뒤로", async ({ page }) => {
      await gotoReady(page, "/market");
      await row(page).getByRole("link", { name: "요리", exact: true }).click();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await row(page).getByRole("link", { name: "보석", exact: true }).click();
      await expect(page).toHaveURL(/\/market\/gems/);
      const requests = await watchFrames(page);
      await page.goBack();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await noWrongBoard(page, requests, "FOOD", "요리");
      await page.goForward();
      await expect(page).toHaveURL(/\/market\/gems/);
      await page.goBack();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
    });

    test("시세 → 각인서 → 전설 → 장신구 → 뒤로: 등급까지", async ({ page }) => {
      await gotoReady(page, "/market");
      await row(page).getByRole("link", { name: "각인서", exact: true }).click();
      await page.getByRole("group", { name: "등급" }).getByRole("button", { name: "전설" }).click();
      await expectBoard(page, { tab: "ENGRAVING_BOOK", label: "각인서", grade: "전설" });
      await row(page).getByRole("link", { name: "장신구", exact: true }).click();
      await expect(page).toHaveURL(/\/market\/accessories/);
      await page.goBack();
      await expectBoard(page, { tab: "ENGRAVING_BOOK", label: "각인서", grade: "전설" });
    });

    test("시세 → 요리 → 재료 견적(위 탭) → 뒤로", async ({ page }) => {
      await gotoReady(page, "/market");
      await row(page).getByRole("link", { name: "요리", exact: true }).click();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await page.getByRole("link", { name: "재료 견적", exact: true }).first().click();
      await expect(page).toHaveURL(/\/market\/quote/);
      const requests = await watchFrames(page);
      await page.goBack();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await noWrongBoard(page, requests, "FOOD", "요리");
    });

    // codex #1669 P1 + P2: the pick re-read the old address once (Next updates it later) and kept the last
    // category's rows under the new name until its answer. The answer is held, so that wait is long.
    test("그 자리에서 고르는 동안 이전 표 · 다른 분류 요청이 없다(답이 늦어도)", async ({ page }) => {
      await gotoReady(page, "/market");
      await page.route(/\/api\/markets\/board\?.*tab=FOOD/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      });
      const requests = await watchFrames(page);
      await row(page).getByRole("link", { name: "요리", exact: true }).click();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await expect(heading(page)).toContainText(/\d+종/);
      await noWrongBoard(page, requests, "FOOD", "요리");
    });

    test("검색어도 뒤로 오면 주소와 같다", async ({ page }) => {
      await gotoReady(page, "/market");
      const search = page.getByRole("searchbox", { name: "품목 이름" });
      await search.fill("파괴");
      await expect(page).toHaveURL(/[?&]q=%ED%8C%8C%EA%B4%B4(&|$)/);
      await row(page).getByRole("link", { name: "보석", exact: true }).click();
      await expect(page).toHaveURL(/\/market\/gems/);
      await page.goBack();
      await expect(page).toHaveURL(/[?&]q=%ED%8C%8C%EA%B4%B4(&|$)/);
      await expect(search).toHaveValue("파괴");
    });

    // codex #1669 delta: with no placeholder for another category, the freshness line vanished while the answer
    // loaded and came back (a counted shift below the list); the rows are sampled too (never the last board's).
    test("답이 늦은 분류를 고르는 동안 표 아래 줄이 같은 높이로 남고 이전 행이 없다", async ({ page }) => {
      await gotoReady(page, "/market");
      const fresh = page.locator('section[aria-labelledby="board-heading"] [class*="freshness"]');
      const height = Math.round((await fresh.boundingBox()).height);
      expect(height).toBeGreaterThan(0);
      await page.route(/\/api\/markets\/board\?.*tab=FOOD/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      });
      const requests = await watchFrames(page);
      await row(page).getByRole("link", { name: "요리", exact: true }).click();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await expect(heading(page)).toContainText(/\d+종/);
      await noWrongBoard(page, requests, "FOOD", "요리");
      const frames = await framesOf(page);
      expect(frames.filter((f) => f.fresh !== height).length, `표 아래 줄 높이(처음 ${height}): ${show(frames)}`).toBe(0);
    });

    test("빠르게 요리 → 각인서 → 요리를 고른 뒤 보석 → 뒤로: 주소대로", async ({ page }) => {
      await gotoReady(page, "/market");
      for (const name of ["요리", "각인서", "요리"]) await row(page).getByRole("link", { name, exact: true }).click();
      await row(page).getByRole("link", { name: "보석", exact: true }).click();
      await expect(page).toHaveURL(/\/market\/gems/);
      const requests = await watchFrames(page);
      await page.goBack();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await noWrongBoard(page, requests, "FOOD", "요리");
    });

    // codex #1669 round 3: a soft push (Next's router) to another category of the same page, so the board
    // stays mounted — the paths a remount on Back would hide.
    const push = (page, url) => page.evaluate((to) => window.next.router.push(to), url);

    test("검색어를 치다 말고 뒤로(같은 시세 화면): 그 검색은 보내지지 않고 칸이 주소대로 비어 있다", async ({ page }) => {
      await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
      await push(page, "/market?tab=FOOD");
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      const searches = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/markets/board") && new URL(request.url()).searchParams.has("q")) searches.push(request.url());
      });
      const search = page.getByRole("searchbox", { name: "품목 이름" });
      await search.fill("파괴");
      // Before the 300 ms rest is over.
      await page.goBack();
      await expectBoard(page, { tab: "ENGRAVING_BOOK", label: "각인서" });
      // Longer than the search's rest: a send left running would ask now.
      await page.waitForTimeout(800);
      expect(searches, "보내진 검색").toEqual([]);
      expect(new URL(page.url()).searchParams.get("q")).toBeNull();
      await expect(search).toHaveValue("");
    });

    test("요리 → (한 번에) 각인서 · 요리를 고른 뒤 각인서로 이동하면 각인서 표", async ({ page }) => {
      await gotoReady(page, "/market");
      await row(page).getByRole("link", { name: "요리", exact: true }).click();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      // Two picks in one task: their writes arrive as one address — the one already shown — so nothing marks
      // them done; the older one (각인서) must not count as the board's own later.
      await page.evaluate(async () => {
        const link = (name) => [...document.querySelectorAll('nav[aria-label="시세 분류"] a')].find((a) => a.textContent.trim() === name);
        link("각인서").click();
        // React applies the press in a microtask (so 요리 is no longer the marked link); Next's address update is
        // a transition that renders later, so both writes still arrive as one address.
        await Promise.resolve();
        await Promise.resolve();
        link("요리").click();
      });
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      const requests = await watchFrames(page);
      await push(page, "/market?tab=ENGRAVING_BOOK");
      await expectBoard(page, { tab: "ENGRAVING_BOOK", label: "각인서" });
      await expect(heading(page)).toContainText(/\d+종/);
      const frames = await framesOf(page);
      expect(frames.at(-1).rows.every((name) => name.includes("ENGRAVING_BOOK")), `마지막 표: ${show(frames)}`).toBe(true);
      expect(requests.filter((asked) => asked !== "ENGRAVING_BOOK" && asked !== "FOOD"), `다른 분류 요청: ${requests}`).toEqual([]);
    });

    test("같은 시세 화면 안에서 뒤로: 남은 쓰기가 있어도 돌아온 주소의 표(popstate가 먼저 그려져도)", async ({ page }) => {
      await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
      await push(page, "/market?tab=FOOD");
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      // Leaves the board's own 각인서 write pending, as above.
      await page.evaluate(async () => {
        const link = (name) => [...document.querySelectorAll('nav[aria-label="시세 분류"] a')].find((a) => a.textContent.trim() === name);
        link("각인서").click();
        // React applies the press in a microtask (so 요리 is no longer the marked link); Next's address update is
        // a transition that renders later, so both writes still arrive as one address.
        await Promise.resolve();
        await Promise.resolve();
        link("요리").click();
      });
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await page.goBack();
      await expectBoard(page, { tab: "ENGRAVING_BOOK", label: "각인서" });
      await expect(heading(page)).toContainText(/\d+종/);
      const names = await page.locator('section[aria-labelledby="board-heading"] ul li button').allTextContents();
      expect(names.length).toBeGreaterThan(0);
      expect(names.filter((name) => !name.includes("ENGRAVING_BOOK")), "각인서 표의 행").toEqual([]);
    });
  });
