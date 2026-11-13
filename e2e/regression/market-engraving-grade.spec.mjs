// 회귀(사용자 11-12): 각인서 시세에 등급 거르기 전체 · 유물 · 전설(처음 전체). 재련 재료의 T4·T3처럼 한 줄, 고른
// 등급은 주소에 남는다(replaceState). 거르기는 탭 전체에서(api `grade`, 쪽 나눔 전에). 다른 분류에는 없고, 등급
// 거르기 전 api(응답에 grade 없음)면 보이지 않는다. 320에서 넘침 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const board = (page) => page.getByRole("region", { name: /각인서 시세/ });
const grades = (page) => page.getByRole("group", { name: "등급" });

for (const width of [320, 1280])
  test(`${width}: 각인서 등급 전체 · 유물 · 전설, 고르면 그 등급만(주소에 남음) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
    await expect(grades(page).getByRole("button")).toHaveText(["전체", "유물", "전설"]);
    await expect(grades(page).getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
    await expect(board(page).getByRole("listitem")).toHaveCount(10);
    // The mock's 각인서: 3 유물 and 4 전설 over the whole tab (not only this page).
    await grades(page).getByRole("button", { name: "유물" }).click();
    await expect(page).toHaveURL(/grade=%EC%9C%A0%EB%AC%BC/);
    await expect(board(page).getByRole("listitem")).toHaveCount(3);
    await grades(page).getByRole("button", { name: "전설" }).click();
    await expect(board(page).getByRole("listitem")).toHaveCount(4);
    await expect(grades(page).getByRole("button", { name: "전설" })).toHaveAttribute("aria-pressed", "true");
    await grades(page).getByRole("button", { name: "전체" }).click();
    await expect(page).not.toHaveURL(/grade=/);
    await expect(board(page).getByRole("listitem")).toHaveCount(10);
    await expectNoHorizontalOverflow(page);
  });

test("주소의 등급으로 다시 열고, 다른 분류로 가면 등급 거르기는 없다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK&grade=%EC%A0%84%EC%84%A4");
  await expect(grades(page).getByRole("button", { name: "전설" })).toHaveAttribute("aria-pressed", "true");
  await expect(board(page).getByRole("listitem")).toHaveCount(4);
  await page.getByRole("tablist", { name: "시세 분류" }).getByRole("tab", { name: "재련 재료", exact: true }).click();
  await expect(page).not.toHaveURL(/grade=/);
  await expect(grades(page)).toHaveCount(0);
});

test("등급 거르기 전 api(응답에 grade 없음)면 거르기를 보이지 않는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  // The web's own route answers { ok, envelope }: drop the echo as an older api would.
  await page.route(/\/api\/markets\/board\?/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.envelope?.data) delete body.envelope.data.grade;
    await route.fulfill({ response, json: body });
  });
  // Start elsewhere (the first board comes with the page), then open 각인서 through the route.
  await gotoReady(page, "/market");
  await page.getByRole("tablist", { name: "시세 분류" }).getByRole("tab", { name: "각인서", exact: true }).click();
  await expect(board(page).getByRole("listitem")).toHaveCount(10);
  await expect(grades(page)).toHaveCount(0);
});
