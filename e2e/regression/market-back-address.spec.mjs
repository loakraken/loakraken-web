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
 * From now on, every painted frame's board heading and marked category (each change once), and every board
 * request. A soft navigation (an in-place pick, Back) keeps the document, so nothing between is missed —
 * a board that stays a while and one that comes back for a single frame alike.
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
    const sample = () => {
      const heading = document.querySelector("#board-heading")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const current = document.querySelector('nav[aria-label="시세 분류"] [aria-current="page"]')?.textContent?.trim() ?? "";
      const frame = `${heading} | ${current}`;
      if (window.__frames.at(-1) !== frame) window.__frames.push(frame);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  return requests;
};

/** No frame since watchFrames showed the 재련 재료 board or marked it, and every board request was for `tab`. */
const noWrongBoard = async (page, requests, tab) => {
  const frames = await page.evaluate(() => window.__frames);
  expect(frames.filter((frame) => frame.includes("재련 재료")), `보인 표 | 고른 분류: ${frames.join(" → ")}`).toEqual([]);
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
      await noWrongBoard(page, requests, "FOOD");
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
      await noWrongBoard(page, requests, "FOOD");
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
      await noWrongBoard(page, requests, "FOOD");
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
  });
