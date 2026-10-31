// 통계 B4 구성: 직업 표 아래 역할 · 직업군 · 서포터 직업별 역할. 역할 칸 합은 표본과 같고,
// '서포터 직업 딜러' 뜻은 ⓘ로 열린다. 320·360·1280에서 옆 넘침·잘린 숫자·흔들림이 없다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const block = (page) => page.getByRole("region", { name: "표본 구성" });
const part = (page, name) => block(page).getByRole("group", { name, exact: true });

for (const width of [1280, 360, 320])
  test(`통계 구성 블록 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/stats");
    await expect(block(page)).toBeVisible();
    // 역할: 딜러 직업 · 서포터 직업 딜러 · 서포터 (목에는 미확인 0명), 인원 합 = 표본 카드의 숫자.
    const roles = part(page, "역할").getByRole("listitem");
    await expect(roles).toHaveCount(3);
    await expect(roles.nth(1)).toContainText("서포터 직업 딜러");
    const people = async (items) =>
      (await items.locator("small").allTextContents()).reduce((sum, t) => sum + Number(t.replace(/[^\d]/g, "")), 0);
    const sample = Number((await page.locator("dl dd").first().textContent()).replace(/[^\d]/g, ""));
    expect(await people(roles), "역할 인원 합 = 표본").toBe(sample);
    // 직업군: 공식 직업군만(목의 직업은 모두 알려진 직업), 인원 합도 표본.
    const groups = part(page, "직업군").getByRole("listitem");
    expect(await groups.count()).toBeGreaterThanOrEqual(5);
    await expect(part(page, "직업군")).not.toContainText("기타");
    expect(await people(groups), "직업군 인원 합 = 표본").toBe(sample);
    // 서포터 직업: 네 직업, 각각 서포터·딜러 비율.
    const support = part(page, "서포터 직업별 역할").getByRole("listitem");
    await expect(support).toHaveCount(4);
    await expect(support.first()).toContainText(/서포터 [\d.]+% · 딜러 [\d.]+%/);
    // 뜻 풀이는 누르면 열린다(휴대폰 포함).
    await block(page).getByRole("button", { name: "서포터 직업 딜러 설명" }).click();
    await expect(page.getByRole("dialog")).toContainText("딜러로 확인된 캐릭터");
    await page.keyboard.press("Escape");
    // 숫자·이름이 잘리지 않고, 화면 밖으로 나가지 않는다.
    const cut = await block(page).evaluate((el) =>
      [...el.querySelectorAll("li > span")].filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent.trim()),
    );
    expect(cut, "잘린 칸").toEqual([]);
    await expectNoHorizontalOverflow(page);
    // 다른 탭에 갔다 오면 제자리(흔들림 0).
    const moved = await shiftsDuring(page, async () => {
      await page.getByRole("tab", { name: "서버" }).click();
      await page.getByRole("tab", { name: "직업" }).click();
      await expect(block(page)).toBeVisible();
    });
    expect(moved.all, `흔들림 (${moved.moved})`).toBe(0);
  });
