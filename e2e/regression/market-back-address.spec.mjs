// 회귀(QA 11-15 04시 P2-1, PM 총괄 P1): 시세에서 분류를 그 자리에서 고른 뒤(주소만 바뀜) 다른 화면에 갔다가 뒤로
// 오면, 주소는 고른 분류(/market?tab=FOOD)인데 줄과 표는 처음 연 분류(재련 재료)였다. 그 자리 고르기는 주소를
// replaceState로 쓰고, 표는 처음 그릴 때의 서버 값만 읽었다. 이제 표는 주소를 읽어, 뒤로 · 앞으로 와도 주소가
// 말하는 분류 · 등급을 보여 준다(처음부터, 다른 분류가 비쳤다 바뀌지 않고).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const row = (page) => page.getByRole("navigation", { name: "시세 분류" });
const heading = (page) => page.locator("#board-heading");

/** Records every board heading text from now on, so a wrong board that flashes before the right one is seen. */
const watchHeadings = (page) =>
  page.evaluate(() => {
    window.__headings = [];
    const note = () => {
      const text = document.querySelector("#board-heading")?.textContent?.replace(/\s+/g, " ").trim();
      if (text && window.__headings.at(-1) !== text) window.__headings.push(text);
    };
    note();
    new MutationObserver(note).observe(document.body, { subtree: true, childList: true, characterData: true });
  });

// Back is a soft navigation (same document): the watcher set before it sees every heading on the way back.
const noFirstBoard = async (page) => {
  const seen = await page.evaluate(() => window.__headings);
  expect(seen.filter((text) => text.includes("재련 재료 시세")), `뒤로 온 뒤 보인 표 머리: ${seen.join(" → ")}`).toEqual([]);
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
      await watchHeadings(page);
      await page.goBack();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await noFirstBoard(page);
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
      await watchHeadings(page);
      await page.goBack();
      await expectBoard(page, { tab: "FOOD", label: "요리" });
      await noFirstBoard(page);
    });
  });
