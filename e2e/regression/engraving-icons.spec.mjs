// 회귀(사용자 10-31, 백엔드 #780): 각인 이름 왼쪽에 각인 아이콘. 이름은 띄어쓰기를 빼고 맞춘다('잔재된 기운' =
// '잔재된기운'). 아이콘이 없는 각인은 빈 자리(회색 상자 없음)이고, 자리는 처음부터 잡혀 있어 이름이 움직이지 않는다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [360, 1280])
  test(`${width}: 각인 아이콘은 이름 왼쪽, 없으면 빈 자리, 이름 줄 맞춤 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    // 대세블레이드 carries 돌격대장·아드레날린·원한·잔재된 기운·질량 증가 in the mock.
    await gotoReady(page, characterPath("대세블레이드"));
    const panel = page.getByRole("region", { name: "각인", exact: true });
    const row = (name) => panel.locator("li").filter({ has: page.getByText(name, { exact: true }) }).first();
    // Matched without spaces; a name with no icon keeps an empty slot.
    await expect(row("잔재된 기운").locator("img")).toHaveAttribute("src", /achieve_13\.png$/);
    await expect(row("원한").locator("img")).toHaveCount(1);
    await expect(row("질량 증가").locator("img")).toHaveCount(0);
    // Every name starts at the same x (the icon slot is always there).
    const lefts = await panel.locator("li strong").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(lefts).size, `이름 시작 위치 ${lefts}`).toBe(1);
    // 사용자 11-01: head = book code on the left, '아크 패시브 활성화' on the right;
    // relic count with the official red marker, stone level with the blue one
    // (screen readers still hear '유물 ×4', '스톤 Lv.3').
    const head = panel.locator("p").first();
    await expect(head.locator("b")).toHaveText(/^각인 조합 \d+$/);
    await expect(head.locator(":scope > span")).toHaveText("아크 패시브 활성화");
    const headBox = await head.evaluate((el) => {
      const [code, state] = [el.querySelector("b"), el.querySelector(":scope > span")].map((n) => n.getBoundingClientRect());
      return { codeLeft: Math.round(code.left - el.getBoundingClientRect().left), stateRight: Math.round(el.getBoundingClientRect().right - state.right) };
    });
    expect(headBox).toEqual({ codeLeft: 0, stateRight: 0 });
    const marks = async (name) =>
      row(name).locator("i").evaluateAll((els) =>
        els.map((el) => [el.dataset.kind, getComputedStyle(el, "::before").backgroundPosition, getComputedStyle(el, "::before").backgroundImage.includes("/pc/profile/img_engrave_icon.png")]),
      );
    expect(await marks("아드레날린")).toEqual([["relic", "-29px 0px", true], ["stone", "0px 0px", true]]);
    expect(await marks("돌격대장")).toEqual([["relic", "-29px 0px", true]]);
    await expect(row("아드레날린")).toContainText("유물 ×4");
    await expect(row("아드레날린")).toContainText("스톤 Lv.3");
    await expect(row("원한")).toContainText("스톤 Lv.2");
    await page.waitForTimeout(600);
    const { quiet, moved } = await shiftsSince(page);
    expect(quiet, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
