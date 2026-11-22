// 장신구 매물 검색 conditions in the address (#1925, codex follow-up P3s): (1) the address never starts a search —
// no accessory-search POST on load, reload, back, forward or an outside change; (2) only the polish effects the
// slot and role take stay (and in the address); (3) 깨달음 최소 stays within the grade and slot's top.
import { test, expect, gotoReady, chooseOption } from "../support/fixtures.mjs";

const PATH = "/market/accessories/search";
const param = (page, key) => new URL(page.url()).searchParams.get(key);

test("주소로 열고 새로고침·뒤로·앞으로·화면 안 링크를 거쳐도 검색 요청은 한 번도 나가지 않는다 @regression", async ({ page }) => {
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/markets/accessory-search")) posts += 1;
  });
  await gotoReady(page, `${PATH}?slot=RING&grade=RELIC&polish=CRIT_DAMAGE:MID&range=70`);
  const ring = page.getByRole("radiogroup", { name: "부위" }).getByRole("radio", { name: "반지" });
  await expect(ring).toBeChecked();
  await expect(page.getByRole("combobox", { name: "치명타 피해" })).toHaveText("중 이상");
  await page.reload();
  await expect(ring).toBeChecked();
  await page.goto("/tools");
  await page.goBack();
  await expect(ring).toBeChecked();
  await page.goForward();
  await page.goBack();
  await expect(ring).toBeChecked();
  // An outside change: this view's own link (the default address).
  await page.getByRole("link", { name: "매물 검색" }).click();
  await expect.poll(() => param(page, "slot")).toBeNull();
  await expect(page.getByRole("radiogroup", { name: "부위" }).getByRole("radio", { name: "목걸이" })).toBeChecked();
  await page.waitForTimeout(500);
  expect(posts, "accessory-search POSTs").toBe(0);
});

test("부위·역할이 받지 않는 연마 효과는 주소에 남지 않는다 @regression", async ({ page }) => {
  // 치명타 피해 is a ring effect (딜러), not a necklace one.
  await gotoReady(page, `${PATH}?slot=NECKLACE&polish=CRIT_DAMAGE:MID,ENEMY_DAMAGE:HIGH`);
  await expect(page.getByRole("combobox", { name: "적에게 주는 피해 증가" })).toHaveText("상 이상");
  await expect.poll(() => param(page, "polish")).toBe("ENEMY_DAMAGE:HIGH");
  // Another slot: the necklace's pick does not ride along in the address.
  await page.getByRole("radiogroup", { name: "부위" }).getByRole("radio", { name: "반지" }).click();
  await expect.poll(() => param(page, "polish")).toBeNull();
  await expect(page.getByRole("combobox", { name: "치명타 피해" })).toHaveText("상관없음");
});

test("깨달음 최소는 등급·부위의 최댓값 안으로 (주소도) @regression", async ({ page }) => {
  // 유물 귀걸이는 9까지.
  await gotoReady(page, `${PATH}?grade=RELIC&slot=EARRING&enl=13`);
  await expect(page.getByRole("combobox", { name: "깨달음 최소" })).toHaveText("9 이상");
  await expect.poll(() => param(page, "enl")).toBe("9");
  // A lower top after a change: 고대 목걸이 12 → 유물 반지 9.
  await gotoReady(page, `${PATH}?grade=ANCIENT&slot=NECKLACE`);
  await chooseOption(page, page.getByRole("combobox", { name: "깨달음 최소" }), "12 이상");
  await page.getByRole("radiogroup", { name: "등급" }).getByRole("radio", { name: "유물" }).click();
  await expect(page.getByRole("combobox", { name: "깨달음 최소" })).toHaveText("10 이상");
  await expect.poll(() => param(page, "enl")).toBe("10");
});
