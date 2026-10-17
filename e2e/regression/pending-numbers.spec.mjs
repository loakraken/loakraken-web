// 회귀: 조건을 바꾸는 동안 이전 조건의 숫자가 표시 없이 보이지 않는다(사용자 10-12, PM 총괄 00:37).
// 새 값을 불러오는 동안 이전 값은 같은 자리에서 흐려지고 aria-busy가 붙으며, 이미 본 조건으로
// 돌아오면 캐시 값을 바로 보여 준다. 응답을 1.2초 늦춰 불러오는 구간을 만든다.
import { test, expect, chooseOption, gotoReady } from "../support/fixtures.mjs";

/** Samples "anything busy?" every frame for a while; true if it ever was. */
const everBusy = (page, ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const end = performance.now() + ms;
        let busy = false;
        const tick = () => {
          busy ||= !!document.querySelector("main [aria-busy=true]");
          if (performance.now() < end) requestAnimationFrame(tick);
          else resolve(busy);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

const slow = (page, pattern) =>
  page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });

/** Logs every frame: the chosen filter label, and each population number with its busy state. */
const record = (page, filter, values) =>
  page.evaluate(
    ({ filter, values }) => {
      window.__frames = [];
      const tick = () => {
        const label = [...document.querySelectorAll("label")].find((l) => l.textContent.startsWith(filter));
        const chosen = label?.querySelector("[role=combobox]")?.textContent.trim() ?? "";
        const shown = [...document.querySelectorAll("main *")]
          .filter((el) => el.children.length === 0 && values.some((v) => el.textContent.includes(v)))
          .map((el) => ({ value: values.find((v) => el.textContent.includes(v)), busy: !!el.closest("[aria-busy=true]") }));
        window.__frames.push({ chosen, shown });
        if (window.__frames.length < 600) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { filter, values },
  );

test("통계: 최근 확인 30일→7일→30일 동안 다른 조건의 표본 수가 표시 없이 보이지 않는다 @regression", async ({ page }) => {
  // 목 표본 수: 30일 104,625명, 7일 41,865명(tests/mock-backend.mjs).
  const expected = { "30일": "104,625", "7일": "41,865" };
  await gotoReady(page, "/stats?tab=distribution");
  await slow(page, "**/api/stats/**");
  await record(page, "최근 확인", Object.values(expected));
  const days = page.getByRole("combobox", { name: "최근 확인" });
  await chooseOption(page, days, "7일");
  // The new values may come with the page's own server answer (the open tab is
  // filled there) in well under 100ms: the busy frames are read from the
  // per-frame record below rather than polled for here.
  await expect(page.locator("main").getByText(expected["7일"]).first()).toBeVisible();
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0, { timeout: 10_000 });
  const switched = await page.evaluate(() => window.__frames.length);
  // 처음 본 조건(30일)으로 돌아오면 캐시 값이 바로: 흐려지는 프레임이 없다(#540 P2).
  await chooseOption(page, days, "30일");
  expect(await everBusy(page, 1500), "이미 본 30일로 돌아왔는데 흐려짐").toBe(false);
  const frames = await page.evaluate(() => window.__frames);
  const wrong = frames.flatMap((f) =>
    f.shown.filter((s) => expected[f.chosen] && s.value !== expected[f.chosen] && !s.busy).map((s) => `${f.chosen}에 ${s.value}`),
  );
  expect(wrong, "다른 조건의 숫자가 표시 없이 보인 프레임").toEqual([]);
  // While 7일 loaded, the 30일 number was there marked busy (dimmed) for at least a frame.
  expect(
    frames.slice(0, switched).some((f) => f.shown.some((s) => s.value === expected["30일"] && s.busy)),
    "7일을 불러오는 동안 이전 값이 흐려진 프레임",
  ).toBe(true);
  expect(frames.length).toBeGreaterThan(30);
});

test("랭킹: 새 조건을 불러오는 동안 표가 흐려지고 aria-busy, 돌아오면 바로 원래 값 @regression", async ({ page }) => {
  await gotoReady(page, "/rankings");
  const table = page.getByRole("region", { name: /랭킹 1쪽/ }).locator("table");
  await expect(table).not.toHaveAttribute("aria-busy", "true");
  await slow(page, "**/api/rankings**");
  const days = page.getByRole("combobox", { name: "최근 확인" });
  await chooseOption(page, days, "7일");
  await expect(table).toHaveAttribute("aria-busy", "true");
  expect(await table.evaluate((el) => getComputedStyle(el).opacity)).not.toBe("1");
  await expect(table).not.toHaveAttribute("aria-busy", "true", { timeout: 10_000 });
  // 이미 본 조건(첫 화면 = 30일)은 캐시에서 바로: 흐려지는 프레임이 없다(#540 P2).
  await chooseOption(page, days, "30일");
  expect(await everBusy(page, 1500), "이미 본 30일로 돌아왔는데 흐려짐").toBe(false);
});
