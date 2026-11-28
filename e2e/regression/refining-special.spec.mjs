// M42 특수 재련 돌파석 가치 (SPECIAL_STONE, on in e2e): the section keeps every row from the first frame, so the answer
// arriving rewrites text in place and nothing under the rows moves (A7, boxes compared, not only the shift log). Then
// typed prices: one request per pause (debounced), the values follow, and '시세로 되돌리기' brings the market back.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const PATH = "**/api/refining/special-stone-values";

for (const width of [320, 1280]) {
  test(`${width}: 돌파석 가치가 와도 순위 줄과 그 아래가 제자리다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    let release;
    const held = new Promise((resolve) => (release = resolve));
    let served = 0;
    await page.route(PATH, async (route) => {
      if (++served === 1) await held;
      await route.continue();
    });
    await page.goto("/tools/refining");
    const section = page.locator("section", { has: page.getByText("특수 재련 돌파석 가치", { exact: true }) });
    await section.scrollIntoViewIfNeeded();
    // The request waits until the section nears the screen; held, the rows show '—'.
    await expect.poll(() => served).toBe(1);
    await expect(section.getByRole("status")).toHaveText("돌파석 가치를 계산하고 있어요…");
    const rows = section.locator("ol > li");
    await expect(rows).toHaveCount(28);
    await expect(rows.first()).toContainText("—");

    const boxes = () =>
      section.evaluate((root) =>
        [
          ...root.querySelectorAll("h3"),
          root.querySelector("details > summary"),
          ...root.querySelectorAll("ol > li"),
        ].map((el) => {
          const box = el.getBoundingClientRect();
          return [Math.round(box.y * 10) / 10, Math.round(box.height * 10) / 10];
        }),
      );
    await page.waitForTimeout(400);
    const before = await boxes();
    const mark = await shiftMark(page);

    release();
    await expect(rows.first()).toContainText(/\d[\d,]*\.\d\sG/);
    await expect(section.getByRole("status")).toContainText("기준");
    await page.waitForTimeout(400);
    expect(await boxes(), "순위 줄 · 제목 · 재료 값 접기 위치와 높이").toEqual(before);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
}

test("바꾼 재료 값은 멈춘 뒤 한 번만 묻고, 시세로 되돌리면 처음 값으로 돌아온다 @regression", async ({ page }) => {
  const bodies = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/refining/special-stone-values")) bodies.push(request.postDataJSON());
  });
  await page.goto("/tools/refining");
  const section = page.locator("section", { has: page.getByText("특수 재련 돌파석 가치", { exact: true }) });
  await section.scrollIntoViewIfNeeded();
  const first = section.locator("ol > li").first();
  await expect(first).toContainText(/\d[\d,]*\.\d\sG/);
  const market = await first.textContent();
  expect(bodies).toHaveLength(1);
  expect(bodies[0].targets).toHaveLength(28);
  expect(bodies[0].prices).toBeUndefined();

  await section.getByText("재료 값 바꾸기").click();
  const field = section.getByRole("textbox", { name: "운명의 파괴석 결정" });
  await field.pressSequentially("20", { delay: 50 });
  await expect(first).not.toHaveText(market);
  expect(bodies).toHaveLength(2);
  expect(bodies[1].prices).toEqual([{ name: "운명의 파괴석 결정", unitPriceGold: 20 }]);
  await expect(section.getByRole("status")).toContainText("바꾼 재료 값 1개");
  // In the address like every input on the page (#889): a reload keeps it, from the cache-free start.
  await expect.poll(() => new URL(page.url()).searchParams.get("stone")).toBe(JSON.stringify({ "운명의 파괴석 결정": "20" }));

  // Not a price: marked, not sent.
  await field.fill("1.234");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(section.getByText("0~10억 골드, 소수 둘째 자리까지 넣어 주세요.")).toBeVisible();

  await section.getByRole("button", { name: "시세로 되돌리기" }).click();
  await expect(first).toHaveText(market);
  await expect(field).toHaveValue("");
  await expect.poll(() => new URL(page.url()).searchParams.get("stone")).toBeNull();
  await expect(section.getByRole("button", { name: "시세로 되돌리기" })).toBeFocused();
  // The market answer comes from the cache: no third request.
  expect(bodies).toHaveLength(2);
});

test("다시 불러와도 올바른 재료 값은 남고, 잘못 넣은 칸 하나만 빠진다 @regression", async ({ page }) => {
  // PM-프론트 #1974 flag-on blocker 1: one bad field used to cost every typed price on a reload.
  await page.goto("/tools/refining");
  const section = page.locator("section", { has: page.getByText("특수 재련 돌파석 가치", { exact: true }) });
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator("ol > li").first()).toContainText(/\d[\d,]*\.\d\sG/);
  await section.getByText("재료 값 바꾸기").click();
  const good = section.getByRole("textbox", { name: "운명의 파괴석 결정" });
  const bad = section.getByRole("textbox", { name: "용암의 숨결" });
  await good.fill("20");
  await bad.fill("4.567");
  await expect(bad).toHaveAttribute("aria-invalid", "true");
  // Only the valid price reaches the address.
  await expect.poll(() => new URL(page.url()).searchParams.get("stone")).toBe(JSON.stringify({ "운명의 파괴석 결정": "20" }));
  await expect(bad).toHaveAttribute("maxlength", "16");

  // A link with a bad entry beside a good one (hand-edited or from an older build): the good one stays.
  const url = new URL(page.url());
  url.searchParams.set("stone", JSON.stringify({ "운명의 파괴석 결정": "20", "용암의 숨결": "4oo", "운명의 파편": "1".repeat(17) }));
  await page.goto(url.pathname + url.search);
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("status")).toContainText("바꾼 재료 값 1개");
  await section.getByText("재료 값 바꾸기").click();
  await expect(good).toHaveValue("20");
  await expect(bad).toHaveValue("");
  await expect.poll(() => new URL(page.url()).searchParams.get("stone")).toBe(JSON.stringify({ "운명의 파괴석 결정": "20" }));
});
// codex #1974 re-run P2s (SPECIAL_STONE flag-on follow-up).
test.describe("돌파석 가치 켜기 전 보완", () => {
  const open = async (page, path = "/tools/refining") => {
    await page.goto(path);
    const section = page.locator("section", { has: page.getByText("특수 재련 돌파석 가치", { exact: true }) });
    await section.scrollIntoViewIfNeeded();
    return section;
  };

  test("시세가 없는 재료도 칸이 있고, 값을 넣으면 그 단계가 계산된다 @regression", async ({ page }) => {
    // The mock's 전일 평균가 has no price for 상급 아비도스 융화 재료: every stage is PRICE_MISSING naming it.
    const section = await open(page, "/tools/refining?price=YDAY_AVG_PRICE");
    const first = section.locator("ol > li").first();
    await expect(first).toContainText("시세가 없는 재료가 있어 계산하지 않았어요: 상급 아비도스 융화 재료");
    await section.getByText("재료 값 바꾸기").click();
    const field = section.getByRole("textbox", { name: "상급 아비도스 융화 재료" });
    await expect(field).toHaveAttribute("placeholder", "시세 없음");
    await field.fill("221");
    await expect(first).toContainText(/\d[\d,]*\.\d\sG/);
  });

  test("열어 둔 동안 1분마다 다시 묻는다 @regression", async ({ page }) => {
    await page.clock.install();
    let asked = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/refining/special-stone-values")) asked++;
    });
    const section = await open(page);
    await expect(section.locator("ol > li").first()).toContainText(/\d[\d,]*\.\d\sG/);
    expect(asked).toBe(1);
    await page.clock.runFor(61_000);
    await expect.poll(() => asked).toBe(2);
  });

  test("바꾼 값 요청이 실패해도 다시 계산 단추가 보인다 @regression", async ({ page }) => {
    const section = await open(page);
    const first = section.locator("ol > li").first();
    await expect(first).toContainText(/\d[\d,]*\.\d\sG/);
    const market = await first.textContent();
    await section.getByText("재료 값 바꾸기").click();
    // The mock refuses this price as a busy solver every time: the one retry after Retry-After fails too.
    await section.getByRole("textbox", { name: "운명의 파괴석 결정" }).fill("999999");
    const alert = section.getByRole("alert").filter({ hasText: "계산이 몰려 있어요" });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(section.getByRole("button", { name: /다시 계산/ })).toBeVisible();
    await expect(section.getByRole("status")).toContainText("바꾼 값 없이 시세로 계산한 값이에요.");
    await expect(first).toHaveText(market);
  });
});