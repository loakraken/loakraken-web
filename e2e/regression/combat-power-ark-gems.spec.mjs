// 회귀(M49, api #1079, web #1935): 전투력 시뮬레이터 아크 그리드 젬 바꾸기와 바꿔 본 젬 순위. 목 캐릭터 '전투력젬바꿈'은
// 질서 코어(살상연희) · 혼돈 코어(불타는 일격)와 api가 계산하지 않는 혼돈의 별 무기 코어를 가진다. 젬마다 종류 · 의지력 효율
// · 포인트 · 옵션 두 줄을 바꿔 보내고(ARK_GRID_GEM), 바꾼 젬은 하나씩 따로 계산해 전투력 증가율 순으로 보인다. 의지력이
// 모자라면 '계산하지 않음'과 api 문장(준비 중이 아님). 목 서버의 숫자는 합성 값이다.
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

const NAME = "전투력젬바꿈";
const simulate = (r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST";
const gemCard = (page) => page.getByRole("region", { name: "아크 그리드 젬", exact: true });
const ranking = (page) => page.getByRole("region", { name: "바꿔 본 젬 순위", exact: true });
const openGem = async (page, name) => {
  await gemCard(page).getByText(name, { exact: true }).click();
  await expect(gemCard(page).getByRole("combobox", { name: `${name} 종류`, exact: true })).toBeVisible();
};

for (const width of [320, 1280])
  test(`젬 종류 · 옵션을 바꿔 보내고, 바꾼 젬은 따로 계산해 순위로 보인다 (${width}) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent(NAME)}`);
    const card = gemCard(page);
    // The gems of the open cores, as they read now; the weapon core's gem waits with its core.
    await expect(card.getByText("살상연희 젬 1", { exact: true })).toBeVisible();
    await expect(card.getByText("안정 · 공격력 Lv.2 · 추가 피해 Lv.3 · 의지력 효율 4 · 5P")).toBeVisible();
    await expect(card.getByText("불타는 일격 젬 2", { exact: true })).toBeVisible();
    await expect(card.getByText(/^무기 젬/)).toHaveCount(0);
    await expect(ranking(page)).toHaveCount(0);

    // 안정 → 불변: 추가 피해 stays (불변 rolls it), 공격력 becomes the first free option of 불변's pool (보스 피해).
    await openGem(page, "살상연희 젬 1");
    const first = page.waitForRequest((r) => simulate(r) && r.postData()?.includes('"gemType":"불변"'));
    await chooseOption(page, card.getByRole("combobox", { name: "살상연희 젬 1 종류", exact: true }), "불변");
    expect((await first).postDataJSON().changes).toContainEqual({
      kind: "ARK_GRID_GEM", slotIndex: 0, index: 0, gemType: "불변", willEfficiency: 4, point: 5,
      effects: [{ name: "보스 피해", level: 2 }, { name: "추가 피해", level: 3 }],
    });
    // The other line's option is not offered on this one.
    await card.getByRole("combobox", { name: "살상연희 젬 1 옵션 1", exact: true }).click();
    await expect(page.getByRole("option", { name: "추가 피해", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // A second swap with higher options: it ranks first (the mock's number grows with levels and point).
    await openGem(page, "불타는 일격 젬 1");
    await chooseOption(page, card.getByRole("combobox", { name: "불타는 일격 젬 1 옵션 1 레벨", exact: true }), "5");
    await chooseOption(page, card.getByRole("combobox", { name: "불타는 일격 젬 1 옵션 2 레벨", exact: true }), "5");
    const rows = ranking(page).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("불타는 일격 젬 1");
    await expect(rows.first().getByLabel("1위")).toBeVisible();
    await expect(rows.nth(1)).toContainText("살상연희 젬 1");
    await expect(rows.first()).toContainText(/\+\d+\.\d{2}%/);

    // 의지력 효율 1 runs the core short: not computed, the api's sentence, unranked (never '준비 중').
    await openGem(page, "살상연희 젬 2");
    await chooseOption(page, card.getByRole("combobox", { name: "살상연희 젬 2 의지력 효율", exact: true }), "1");
    const short = rows.filter({ hasText: "살상연희 젬 2" });
    await expect(short).toContainText("계산하지 않음");
    await expect(short).toContainText("의지력이 모자라");
    await expect(rows.last()).toContainText("살상연희 젬 2");
    await expect(ranking(page)).not.toContainText("준비 중");

    // Back to the gem worn: it leaves the ranking.
    await card.getByRole("button", { name: "지금 젬으로 되돌리기" }).first().click();
    await expect(rows).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
  });
