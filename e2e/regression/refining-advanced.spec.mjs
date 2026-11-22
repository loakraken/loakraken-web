// 회귀(X3 2단계, web #1951): 재련 기대 비용의 상급 재련. 고른 부위 '상급 +10'은 목표를 다음 10단계 경계로 올리고,
// 부위마다 api advanced-plans(목: api CI 표본으로 만든 구간 줄)를 한 번 묻는다. 구간의 재료 · 재련 골드는 페이지 합계에
// 들어가고(상급만 골라도 결과가 나옴), 재료 시세 요청은 결과 · 숨결 비교가 함께 한 번. 50% · 90% · 장인의 기운에서는
// '상급은 기대값' 줄이 처음부터 잡아 둔 자리에 나온다. 캐릭터의 상급 단계는 툴팁에서 읽고, 전율 부위는 상급이 없다.
import { test, expect, expectNoHorizontalOverflow, gotoReady, chooseOption } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const ADVANCED = "/api/refining/advanced-plans";
const picks = (page) => page.getByRole("group", { name: "고른 부위 한 번에 올리기" });
const card = (page) => page.getByRole("region", { name: "상급 재련" });
const stageBox = (page, label, which) => page.getByRole("combobox", { name: `${label} 상급 재련 ${which} 단계` });

for (const width of [320, 1280])
  test(`${width}: 고른 부위 상급 +10 — 구간 줄, 합계에 들어감, 시세 요청 한 번, 기대값 줄 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    const asked = [];
    page.on("request", (r) => r.url().includes(ADVANCED) && asked.push(r.postDataJSON()));
    let priceCalls = 0;
    page.on("request", (r) => r.url().includes("/api/markets/material-prices") && priceCalls++);
    await gotoReady(page, "/tools/refining");
    await expect(card(page)).toBeVisible();

    // 상급 only (no 일반 target): the result still comes (프론트 condition d).
    await picks(page).getByRole("button", { name: "무기", exact: true }).click();
    await picks(page).getByRole("button", { name: "머리", exact: true }).click();
    await page.getByRole("button", { name: "고른 부위 상급 +10" }).click();
    await expect(stageBox(page, "무기", "목표")).toHaveText("10");
    await expect(stageBox(page, "머리", "목표")).toHaveText("10");
    await expect(page.getByRole("heading", { name: "필요 재료" })).toBeVisible();
    const mark = await shiftMark(page);
    expect(asked.map((r) => [r.equipmentType, r.fromStage, r.toStage]).sort(), "부위마다 한 번").toEqual([
      ["ARMOR", 0, 10],
      ["WEAPON", 0, 10],
    ]);

    // The bands' refine gold is the 재련 골드 (mock: band 0 = 18,625.35 G each → ceil(37,250.70) = 37,251), and their
    // materials are the table's rows.
    await expect(page.getByText(/재련 골드 37,251\b/).first()).toBeVisible();
    // 상급 only: the top line counts its bands, never '총 0단계, 시도 0회'.
    await expect(page.getByText("상급 재련 2구간")).toBeVisible();
    await expect(page.getByText(/총 0단계/)).toHaveCount(0);
    for (const name of ["아비도스 융화 재료", "운명의 돌파석", "운명의 파괴석", "운명의 수호석"])
      await expect(page.getByRole("rowheader", { name: new RegExp(`^${name}`) })).toHaveCount(1);
    const bands = page.locator("details", { hasText: "상급 재련 구간별" });
    await expect(bands.getByRole("rowheader")).toHaveText(["무기 0→10", "머리 0→10"]);
    await expect(bands.getByRole("row").nth(1)).toContainText("선조 숨결");

    // The total at the top and the result's are one number (the two '골드' lines, as refining-total-slot reads them).
    const totals = page.locator("p").filter({ has: page.locator(":scope > span", { hasText: /^골드$/ }) });
    await expect(totals).toHaveCount(2);
    const [top, result] = await totals.evaluateAll((lines) => lines.map((line) => line.textContent.replace(/골드$/, "").trim()));
    expect(top, "위 합계 = 결과 합계").toBe(result);
    expect(Number(top.replace(/\D/g, "")), "상급만으로도 합계").toBeGreaterThanOrEqual(37_251);

    // 50%: the 일반 part follows the mode, 상급 stays expected — said in the line held since the first frame.
    const line = page.getByText("상급 재련은 기대값으로 더했어요.");
    await expect(line).toHaveCount(0);
    await page.getByRole("radiogroup", { name: "확률 기준" }).getByRole("radio", { name: "50%" }).click();
    await expect(line).toBeVisible();
    // One line: the reserve holds it (a second line moved everything under it).
    expect(await line.evaluate((el) => el.getBoundingClientRect().height), "기대값 줄 높이").toBeLessThanOrEqual(19);
    await page.waitForTimeout(400);
    expect(priceCalls, "재료 시세 요청 수").toBe(1);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

test("캐릭터의 상급 단계는 툴팁에서, 전율 부위는 상급 없음, +10은 다음 경계까지 @regression", async ({ page }) => {
  await gotoReady(page, `/tools/refining?character=${encodeURIComponent("재련상급")}`);
  await expect(stageBox(page, "무기", "현재")).toHaveText("21");
  await expect(stageBox(page, "머리", "현재")).toHaveText("13");
  await expect(stageBox(page, "하의", "현재")).toBeDisabled();
  await expect(card(page).getByRole("listitem").filter({ hasText: "하의" })).toContainText("없음");
  // The fixed note says what '없음' means (전율 has none); no sentence comes and goes with the load (#1955).
  await expect(card(page)).toContainText("전율 장비(상급 재련이 없음)");
  // 하의 alone: nothing to raise.
  await picks(page).getByRole("button", { name: "하의", exact: true }).click();
  await expect(page.getByRole("button", { name: "고른 부위 상급 +10" })).toHaveAttribute("aria-disabled", "true");
  await picks(page).getByRole("button", { name: "머리", exact: true }).click();
  await page.getByRole("button", { name: "고른 부위 상급 +10" }).click();
  await expect(stageBox(page, "머리", "목표")).toHaveText("20");
  await expect(page.locator("details", { hasText: "상급 재련 구간별" }).getByRole("rowheader")).toHaveText(["머리 13→20"]);
});

test("툴팁에서 읽지 못한 상급 단계는 0으로 치지 않는다: '모름', +10 · 요청 없음, 고르면 계산 @regression", async ({ page }) => {
  const asked = [];
  page.on("request", (r) => r.url().includes(ADVANCED) && asked.push(r.postDataJSON()));
  await gotoReady(page, `/tools/refining?character=${encodeURIComponent("재련상급")}`);
  const gloves = card(page).getByRole("listitem").filter({ hasText: "장갑" });
  await expect(gloves).toContainText("모름");
  // What '모름' means: the card's fixed note, which the unread field points to (aria-describedby).
  await expect(stageBox(page, "장갑", "현재")).toHaveAccessibleDescription(/상급 재련 단계를 읽지 못한 부위예요/);
  await expect(stageBox(page, "장갑", "현재")).toHaveText("");
  await expect(stageBox(page, "장갑", "목표")).toBeDisabled();
  await picks(page).getByRole("button", { name: "장갑", exact: true }).click();
  await expect(page.getByRole("button", { name: "고른 부위 상급 +10" })).toHaveAttribute("aria-disabled", "true");
  await page.waitForTimeout(400);
  expect(asked, "읽지 못한 부위 요청 없음").toEqual([]);
  // The user picks 7: from there, +10 goes to 10.
  await chooseOption(page, stageBox(page, "장갑", "현재"), "7");
  await expect(gloves).not.toContainText("모름");
  await page.getByRole("button", { name: "고른 부위 상급 +10" }).click();
  await expect(stageBox(page, "장갑", "목표")).toHaveText("10");
  await expect.poll(() => asked.map((r) => [r.equipmentType, r.fromStage, r.toStage])).toEqual([["ARMOR", 7, 10]]);
});

// #1955 (PM-프론트, before the switch goes on): the character answer late (1.2 s, past the 0.5 s input window of an
// address load). The 상급 card keeps its size when its rows fill in ('모름' adds no line: the note is always there), so
// nothing under it moves. Measured on the card's own box: it sits below the fold here, where the shift log would not
// see it, and the 캐릭터 장비 card above has its own (older) growth at the load.
for (const width of [320, 1280])
  test(`${width}: 캐릭터 답이 늦게 와도 상급 재련 카드 크기가 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === "/api/characters",
      async (route) => {
        await held;
        await route.fallback();
      },
    );
    // Not gotoReady: its network-idle wait never ends while the answer is held (the page's own 20 s load timeout
    // then fires first). Drawn and hydrated is enough here.
    await page.goto(`/tools/refining?character=${encodeURIComponent("재련상급")}`);
    const size = () => card(page).evaluate((el) => Math.round(el.getBoundingClientRect().height));
    await expect(card(page)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const before = await size();
    release();
    const gloves = card(page).getByRole("listitem").filter({ hasText: "장갑" });
    await expect(gloves).toContainText("모름", { timeout: 15_000 });
    await expect(stageBox(page, "무기", "현재")).toHaveText("21");
    // The unread target is empty, as the current is (PM-프론트 #1952 P3).
    await expect(stageBox(page, "장갑", "목표")).toHaveText("");
    await page.waitForTimeout(400);
    expect(await size(), "상급 재련 카드 높이(px), 답 전 → 뒤").toBe(before);
  });

test("상급만 실패해도(409) 일반 결과는 그대로, 상급은 따로 알리고 다시 계산 @regression", async ({ page }) => {
  const adv = JSON.stringify({ weapon: { current: 39, target: 40 } });
  await gotoReady(page, `/tools/refining?adv=${encodeURIComponent(adv)}`);
  await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
  // The 일반 result stands.
  await expect(page.getByRole("heading", { name: "필요 재료" })).toBeVisible();
  await expect(page.getByText(/재련 골드 [\d,]+/).first()).toBeVisible();
  // The 상급 part in its own notice, with its own retry; no band table (not in the total).
  const notice = page.getByRole("alert").filter({ hasText: "재료 시세를 모으고 있어요" });
  await expect(notice).toContainText("위 합계에는 상급 재련이 빠져 있어요.");
  await expect(page.getByRole("button", { name: "상급 재련 다시 계산" })).toBeVisible();
  await expect(page.getByText("상급 재련은 빠졌어요(아래에서 다시 계산)")).toBeVisible();
  await expect(page.locator("details", { hasText: "상급 재련 구간별" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다시 계산", exact: true })).toHaveCount(0);
});

/** Each part's first 상급 request answers 409 (price pending), later ones go through: two parts fail, then a retry. */
async function failFirstPerPart(page, asked) {
  const seen = new Set();
  await page.route(
    (url) => url.pathname === ADVANCED,
    async (route) => {
      const body = route.request().postDataJSON();
      asked.push(body.equipmentType);
      if (seen.has(body.equipmentType)) return route.fallback();
      seen.add(body.equipmentType);
      await route.fulfill({ status: 409, json: { ok: false, error: { code: "REFINING_PRICE_PENDING", status: 409 } } });
    },
  );
}
const twoParts = encodeURIComponent(JSON.stringify({ weapon: { current: 0, target: 10 }, helmet: { current: 0, target: 10 } }));

test("상급 재련 다시 계산은 실패한 부위를 모두 다시 묻고, 성공하면 알림이 사라지고 구간이 합계에 든다 @regression", async ({ page }) => {
  const asked = [];
  await failFirstPerPart(page, asked);
  await gotoReady(page, `/tools/refining?adv=${twoParts}`);
  await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
  const notice = page.getByRole("alert").filter({ hasText: "재료 시세를 모으고 있어요" });
  await expect(notice).toBeVisible();
  await expect.poll(() => [...asked].sort()).toEqual(["ARMOR", "WEAPON"]);
  // One press asks both failed parts again (web #1961: before, only the first).
  await page.getByRole("button", { name: "상급 재련 다시 계산" }).click();
  await expect.poll(() => [...asked].sort()).toEqual(["ARMOR", "ARMOR", "WEAPON", "WEAPON"]);
  // Answered: the notice and the top line go, the bands join the result.
  await expect(notice).toHaveCount(0);
  await expect(page.getByText("상급 재련은 빠졌어요(아래에서 다시 계산)")).toHaveCount(0);
  await expect(page.locator("details", { hasText: "상급 재련 구간별" }).getByRole("rowheader")).toHaveText(["무기 0→10", "머리 0→10"]);
});

test("상급만 고른 때 결과 자리의 다시 계산도 실패한 부위를 모두 다시 묻는다 @regression", async ({ page }) => {
  const asked = [];
  await failFirstPerPart(page, asked);
  await gotoReady(page, `/tools/refining?adv=${twoParts}`);
  const alert = page.getByRole("alert").filter({ hasText: "재료 시세를 모으고 있어요" });
  await expect(alert).toBeVisible();
  await expect.poll(() => [...asked].sort()).toEqual(["ARMOR", "WEAPON"]);
  await page.getByRole("button", { name: "다시 계산", exact: true }).click();
  await expect.poll(() => [...asked].sort()).toEqual(["ARMOR", "ARMOR", "WEAPON", "WEAPON"]);
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "필요 재료" })).toBeVisible();
  await expect(page.locator("details", { hasText: "상급 재련 구간별" }).getByRole("rowheader")).toHaveText(["무기 0→10", "머리 0→10"]);
});

test("시세를 모으는 중(409)은 상급 재련의 말로 알린다 @regression", async ({ page }) => {
  const adv = JSON.stringify({ weapon: { current: 39, target: 40 } });
  await gotoReady(page, `/tools/refining?adv=${encodeURIComponent(adv)}`);
  // Our alert (Next's route announcer is an alert too).
  await expect(page.getByRole("alert").filter({ hasText: "재료 시세를 모으고 있어요" })).toContainText("1분쯤 뒤 다시 계산해 주세요");
});
