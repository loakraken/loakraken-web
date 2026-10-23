// 회귀(사용자 제보 v0.3.2): 휴대폰에서 공용 검색 버튼으로 연 검색 화면의 결과 목록이 화면 아래로
// 잘려 마지막 줄(기능·메뉴)에 손가락이 닿지 않았다. 목록은 보이는 화면 안에서 끝나고 안쪽을
// 스크롤해 마지막 줄까지 누를 수 있어야 한다. 키보드가 올라와 보이는 높이가 줄어도 같다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const RECENT = Array.from({ length: 5 }, (_, i) => ({
  name: `표본${i + 1}`,
  server: "루페온",
  className: "바드",
  itemLevel: 1700 + i,
  combatPower: null,
  at: Date.now() - i * 1000,
}));

/** Where the list sits against the visible screen, and whether its last row can be reached. */
async function lastRowReachable(page, list) {
  const last = list.getByRole("option").last();
  await last.scrollIntoViewIfNeeded();
  return page.evaluate(() => {
    const panel = document.querySelector(".rsp");
    const scroll = panel?.querySelector(".rsp-scroll");
    const rows = panel?.querySelectorAll("[role=option]");
    const row = rows?.[rows.length - 1];
    const visible = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;
    if (!panel || !scroll || !row) return { ok: false, why: "no panel" };
    const box = row.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    const info = {
      visible: Math.round(visible),
      panelBottom: Math.round(panel.getBoundingClientRect().bottom),
      rowBottom: Math.round(box.bottom),
      scroll: `${scroll.clientHeight}/${scroll.scrollHeight}`,
    };
    return { ok: box.bottom <= visible + 0.5 && box.top >= 0 && !!hit && row.contains(hit), ...info };
  });
}

for (const [width, height] of [
  [360, 640],
  [360, 800],
  [390, 844],
])
  test.describe(`${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test(`@검색 ${width}×${height}: 결과 목록은 화면 안에서 끝나고 마지막 줄까지 닿는다 @regression`, async ({ page }) => {
      await page.addInitScript((list) => localStorage.setItem("loakraken:recent", JSON.stringify(list)), RECENT);
      await gotoReady(page, "/market");
      await page.getByRole("button", { name: "캐릭터 검색" }).first().click();
      const list = page.getByRole("listbox", { name: "검색 결과" });
      await expect(list.getByRole("group", { name: "기능" })).toBeVisible();
      await page.waitForTimeout(600);

      // Empty field: recent 5 + popular 5 + features.
      const empty = await lastRowReachable(page, list);
      test.info().annotations.push({ type: "빈 칸", description: JSON.stringify(empty) });
      expect(empty.ok, `빈 칸 마지막 줄 ${JSON.stringify(empty)}`).toBe(true);

      // Typed: the character rows, then the menu group.
      await page.getByRole("combobox").fill("랭킹");
      await expect(list.getByRole("group", { name: "메뉴" })).toBeVisible();
      await page.waitForTimeout(400);
      const typed = await lastRowReachable(page, list);
      test.info().annotations.push({ type: "입력", description: JSON.stringify(typed) });
      expect(typed.ok, `메뉴 마지막 줄 ${JSON.stringify(typed)}`).toBe(true);

      // The on-screen keyboard leaves about half the height visible.
      await page.setViewportSize({ width, height: Math.round(height * 0.55) });
      await page.waitForTimeout(400);
      const keyboard = await lastRowReachable(page, list);
      test.info().annotations.push({ type: "키보드", description: JSON.stringify(keyboard) });
      expect(keyboard.ok, `키보드 열린 높이 ${JSON.stringify(keyboard)}`).toBe(true);
      await list.getByRole("option").last().click();
      await expect(list).toHaveCount(0);
    });
  });
