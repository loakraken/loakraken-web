// 회귀: 터치 화면에서 아크 그리드 젬(28px 아이콘)은 아이콘 밖 8px까지 눌러도 카드가 열린다
// (web #459, PM-프론트 #433·#459 검토 P2 — 누르는 영역 44×44). 아이콘 가운데에서
// 18px 떨어진 곳(아이콘 가장자리 14px + 4px)을 탭해 아래 시트가 열리는지 본다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("그리드 젬은 아이콘 밖을 탭해도 카드가 열린다 @regression", async ({ page }) => {
  await page.goto(characterPath("상세", "combat"));
  await page.getByRole("button", { name: "아크 그리드 코어 전체 펼치기" }).click();
  const gem = page.locator('button[aria-label="질서의 젬 : 안정 상세 보기"]:visible').first();
  await gem.scrollIntoViewIfNeeded();
  const box = await gem.boundingBox();
  expect(box?.width).toBe(28);
  // 누르는 영역은 아이콘 밖 8px까지: 18px 지점은 버튼, 30px 지점(이름 글자)은 버튼이 아니다.
  // (탭으로 확인하지 않는 까닭: 크롬은 터치 위치를 가까운 버튼으로 보정해 30px도 열린다.)
  const owner = (dx) =>
    page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label") ?? null, [
      box.x + box.width / 2 + dx,
      box.y + box.height / 2,
    ]);
  expect(await owner(18)).toBe("질서의 젬 : 안정 상세 보기");
  expect(await owner(30)).toBeNull();
  await page.touchscreen.tap(box.x + box.width / 2 + 18, box.y + box.height / 2);
  await expect(page.getByRole("dialog", { name: "질서의 젬 : 안정" })).toBeVisible();
});
