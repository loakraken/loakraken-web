// 회귀(2부 대비, web #1977): api가 공식 장비 정보의 모양이 바뀐 캐릭터를 계산하지 않을 때(2부 원본 형태 가드, 스위치
// 꺼짐 기본) 보내는 GAME_UPDATE_UNSUPPORTED를 웹이 알아보고 그 까닭을 말한다. 목 '업데이트가드'는 모든 화면이 가드가
// 켜진 api처럼 답한다. 일반 문구('계산식을 확인하고 있어', '… · 효율 순', '지금 계산할 수 있는 후보가 없어요')는 나오지 않는다.
import { test, expect, chooseOption, characterPath, expectNoHorizontalOverflow, gotoReady, specUpListPath } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const NAME = "업데이트가드";
const API_TEXT = "게임 업데이트로 바뀐 장비 정보라 아직 계산하지 않아요";

for (const width of [320, 1280])
  test(`${width}: 시뮬레이터 — 바꾼 항목은 게임 업데이트 때문이라고, 젬 가공 순위도 같은 까닭 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent(NAME)}`);
    const refine = page.getByRole("combobox", { name: "무기 재련 단계" });
    const now = Number((await refine.textContent())?.trim());
    // From before the edit: the band's note lands with the answer, after the 0.5 s input window, and must fit its held room.
    const mark = await shiftMark(page);
    await chooseOption(page, refine, String(now >= 25 ? now - 1 : now + 1));
    const band = page.getByRole("region", { name: "예상 전투력" });
    await expect(band).toContainText("바꾼 1개 항목은 게임 업데이트로 바뀐 장비 정보라 아직 계산하지 않아요.");
    await expect(band).not.toContainText("계산식을 확인하고 있어");
    // after / delta are null (api B2): the official value stays, no change figure, never a 0.
    await expect(band).not.toContainText(/[▲▼]|[+−-]0\.00|\(\+0/);
    // The row keeps the api's own sentence, and its badge says 계산하지 않음 like the band, never 'coming soon'
    // (PM-프론트 #1978 P2).
    const row = page.getByRole("region", { name: "바꾼 것" }).getByRole("listitem").first();
    await expect(row).toContainText(API_TEXT);
    await expect(row).toContainText("계산하지 않음");
    await expect(row).not.toContainText("계산 준비 중");
    // api #1129: target is the request kind and from / to are null — never the bare code or a '→' with nothing.
    await expect(row).not.toContainText(/[A-Z]{3,}_[A-Z_]+/);
    await expect(row).not.toContainText("→");

    const card = page.getByRole("region", { name: "젬 가공 순위" });
    await card.getByRole("button", { name: "순위 계산" }).click();
    await expect(card.getByRole("region", { name: "가공 순위 결과" })).toHaveText(
      "게임 업데이트로 바뀐 장비 정보라 아직 젬 가공 순위를 계산하지 않아요.",
    );
    await page.waitForTimeout(400);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

for (const width of [320, 1280])
  for (const sort of ["KRAKEN", "DELTA"])
    test(`${width} ${sort}: 스펙업 — 후보 없이 한 줄, 게임 업데이트 때문이라고 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, `${characterPath(NAME, "specup")}&sort=${sort}`);
      // api B2: no candidate at all (rows would carry numbers from today's tables), one empty-state line.
      await expect(page.locator("p", { hasText: "게임 업데이트로 바뀐 장비 정보라 아직 스펙업 후보를 계산하지 않아요." })).toBeVisible();
      await expect(page.getByRole("table", { name: /스펙업 후보/ })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "아직 계산하지 않은 후보" })).toHaveCount(0);
      await expect(page.getByText("지금 계산할 수 있는 후보가 없어요.")).toHaveCount(0);
      // The 크라켄 sort bar says it too (its hidden room-holding copies are always there, so the status line counts).
      if (sort === "KRAKEN") await expect(page.getByRole("status").filter({ hasText: "업데이트로 아직 계산 안 함" })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: /지금은 점수 정렬 불가|효율 순/ })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });

test("스펙업 추천 순서 · 목표 경로는 api 문장을 그대로 @regression", async ({ page }) => {
  await gotoReady(page, characterPath(NAME, "specup"));
  // 추천 순서 (path): no steps, the api's sentence (never '시세를 몰라' — unpriced is empty).
  await expect(page.getByText(API_TEXT).first()).toBeVisible();
  await expect(page.getByText(/시세를 몰라 순서를 만들 수 없어요/)).toHaveCount(0);
  // knownCostTotal stays 0 under the guard (PM 총괄 02:58): the guard copy, never '0G'.
  await expect(page.getByText(/(^|[^\d,])0G/)).toHaveCount(0);
  // 목표 경로 lives on the list view.
  await gotoReady(page, specUpListPath(NAME));
  const goal = page.getByRole("region", { name: "목표 전투력" });
  await goal.getByRole("textbox", { name: "목표 전투력" }).fill("12507");
  await goal.getByRole("button", { name: "경로 찾기" }).click();
  await expect(goal).toContainText(API_TEXT);
});
