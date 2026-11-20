// 시뮬레이터 깨달음 카르마 레벨(api #1004, web #1781): 아크 패시브 카드에 '깨달음 카르마 레벨'(0~30)이 있고, 바꾸면 요청에
// ARK_PASSIVE_POINT 깨달음 karmaLevel(포인트 없이)을 보낸다. 추천 순서의 카르마 단계(KARMA_LEVEL)는 '이 순서를 시뮬레이터에서
// 열기'에서 빠지지 않고 그 레벨로 들어간다. 지금 레벨은 깨달음 포인트 설명("6랭크 29레벨")에서 api와 같게 읽는다.
// 목: '전투력카르마'·'스펙순서카르마'는 진화 120·깨달음 95(6랭크 29레벨)·도약 60. 운영 호스트에서는 KARMA_SIM이 켜질
// 때까지 이 칸이 없다(평소 실행은 켜진 쪽).
import { test, expect, characterPath, chooseOption, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";

const simulate = (r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST";
const passive = (page) => page.getByRole("region", { name: "아크 패시브", exact: true });
const karma = (page) => passive(page).getByRole("combobox", { name: "깨달음 카르마 레벨", exact: true });
const changed = (page) => page.getByRole("region", { name: "바꾼 것" }).getByRole("listitem").filter({ hasText: "깨달음 카르마" });

for (const width of [320, 1280])
  test(`@A37 ${width} 시뮬레이터: 깨달음 카르마 레벨을 바꾸면 karmaLevel로 보낸다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력카르마")}`);
    await expect(karma(page)).toHaveText("29");
    // The card is open for the karma row; 깨달음 points stay locked beside it.
    await expect(passive(page).getByText("준비 중", { exact: true })).toHaveCount(0);
    await expect(passive(page).getByRole("listitem").filter({ hasText: "깨달음 카르마" })).toContainText("Lv.29");
    const asked = page.waitForRequest((r) => simulate(r) && r.postData()?.includes('"karmaLevel"'));
    await chooseOption(page, karma(page), "30");
    expect((await asked).postDataJSON().changes).toEqual([{ kind: "ARK_PASSIVE_POINT", tree: "깨달음", karmaLevel: 30 }]);
    await expect(changed(page)).toContainText("29 → 30");
    await expect(changed(page)).not.toContainText("계산 준비 중");
    await expectNoHorizontalOverflow(page);
  });

test("@A37 320 추천 순서의 카르마 단계는 빼지 않고 시뮬레이터에서 그 레벨로 연다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(characterPath("스펙순서카르마", "specup"));
  const open = page.getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" });
  await expect(open).toBeVisible();
  // Every step goes in: nothing is left out for the simulator.
  await expect(page.getByText(/단계는 시뮬레이터에서 아직 바꿀 수 없어/)).toHaveCount(0);
  const asked = page.waitForRequest(simulate);
  await open.click();
  const sent = (await asked).postDataJSON().changes.filter((c) => c.kind === "ARK_PASSIVE_POINT");
  expect(sent).toEqual([{ kind: "ARK_PASSIVE_POINT", tree: "깨달음", karmaLevel: 30 }]);
  await expect(karma(page)).toHaveText("30");
  await expect(changed(page)).toContainText("29 → 30");
  await expectNoHorizontalOverflow(page);
});
