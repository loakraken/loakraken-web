// 회귀(M26 1단계 대세 빌드 비교): 직업 상세를 '내 세팅 비교'로 열면 항목마다 1~3위와 비율, 그 밖, 그리고
// 내 세팅이 대세와 같은지·다른지가 글로 보인다(색만이 아님). 첫 로드·직업 각인 바꾸기 흔들림 0.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

const BLADE = `/stats/classes/${encodeURIComponent("블레이드")}`;
const path = `${BLADE}?classEngraving=${encodeURIComponent("잔재된 기운")}&character=${encodeURIComponent("대세블레이드")}`;
const card = (page, title) => page.getByRole("region", { name: /의 세팅과 대세$/ }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

for (const width of [1280, 360])
  test(`@M26 ${width} 항목마다 1~3위·비율·내 세팅과 대세 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, path);
    const compare = page.getByRole("region", { name: "대세블레이드의 세팅과 대세" });
    await expect(compare).toBeVisible();
    await expect(compare.getByRole("status")).toHaveText(/개 항목이 대세와 달라요/);

    // The most chosen set: same, in words, the row tagged "내 세팅".
    const combo = card(page, "각인 조합");
    await expect(combo).toContainText("대세와 같아요");
    await expect(combo.getByRole("listitem").first()).toContainText("내 세팅");
    await expect(combo).toContainText(/다른 조합 \d+개와 인원이 적은 칸 · [\d.]+%/);
    // Second in the list: different, said so.
    await expect(card(page, "아크 패시브 깨달음")).toContainText("대세와 달라요 · 내 세팅은 2위");
    await expect(card(page, "주력 전투 특성")).toContainText("대세와 같아요");
    await expect(card(page, "팔찌 전투 특성")).toContainText("대세와 달라요 · 치명 없음");
    await expect(card(page, "피해 증가 보석")).toContainText("대세와 달라요 · 가장 많은 10레벨이 없음");
    await expect(card(page, "피해 증가 보석")).toContainText("내 보석: 9레벨 1개");
    await expect(card(page, "카드 세트")).toContainText("내 세팅: 세상을 구하는 빛 6세트 30각성");

    await page.waitForTimeout(500);
    const load = await shiftsSince(page);
    expect(load.all, `첫 로드 흔들림 (${load.moved})`).toBe(0);
    // Another class engraving: the comparison stays, nothing moves.
    const moved = await shiftsDuring(page, () => page.getByRole("group", { name: "직업 각인" }).getByRole("button", { name: "전체" }).click(), 1500);
    await expect(page).toHaveURL(/character=/);
    await expect(compare).toBeVisible();
    expect(moved.all, `직업 각인 전환 흔들림 (${moved.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

test("@M26 다른 직업 캐릭터는 비교하지 않고 그렇게 알린다 @regression", async ({ page }) => {
  await gotoReady(page, `${BLADE}?character=${encodeURIComponent("상세")}`);
  const compare = page.getByRole("region", { name: "상세의 세팅과 대세" });
  await expect(compare.getByRole("status")).toHaveText(/^\S+ 캐릭터라 블레이드 대세와 비교하지 않았어요\.$/);
  // No card claims anything about this character.
  await expect(compare.getByText("내 세팅", { exact: true })).toHaveCount(0);
});

test("@M26 표본이 적은 직업은 비교하지 않는다 @regression", async ({ page }) => {
  await gotoReady(page, `/stats/classes/${encodeURIComponent("기상술사")}?character=${encodeURIComponent("상세")}`);
  await expect(page.getByText(/명보다 적어 대세와 비교하지 않아요/)).toBeVisible();
  await expect(page.getByRole("region", { name: /의 세팅과 대세$/ })).toHaveCount(0);
});
