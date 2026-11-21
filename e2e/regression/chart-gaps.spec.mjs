// 회귀(사용자 11-16): 기록이 없는 날은 지어내지 않되 일부러 비운 것으로 읽힌다. 빈 날 양쪽을 옅은 점선으로
// 잇고(선 색·굵기가 아님), 빈 날 위에 올리거나 화살표로 가면 '이날은 기록이 없어요'. 'N일 중 M일치 기록'은
// 기간 버튼 옆(제목 아래 줄)에 있어 차트보다 먼저 보인다. 장신구 칸은 빈 날이 왜 생기는지 한 줄 더.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const GAP = "이날은 기록이 없어요";
const detailOf = (page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "시세 추이" }) });
const countOf = (box) => box.getByText(/^\S+ 중 \d+일치 기록$/);

/**
 * Drop the answer's days at these positions (newest first, today partial at 0). With `newest`, the days are
 * first re-dated from that day back (one per position), so a fixed date such as the accessory warmup start
 * falls on known positions whatever today is.
 */
const dropDays = (page, url, positions, newest) =>
  page.route(url, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const holder = (function find(node) {
      if (!node || typeof node !== "object") return null;
      if (Array.isArray(node.days)) return node;
      for (const value of Object.values(node)) {
        const found = find(value);
        if (found) return found;
      }
      return null;
    })(body);
    if (newest) {
      const top = Date.parse(`${newest}T00:00:00Z`);
      holder.days = holder.days.map((day, i) => ({ ...day, date: new Date(top - i * 86_400_000).toISOString().slice(0, 10) }));
    }
    holder.days = holder.days.filter((_, i) => !positions.includes(i));
    await route.fulfill({ response, json: body });
  });

for (const width of [320, 1280])
  test(`${width}: 시세 추이 빈 날은 점선으로 잇고, 그 위에서 '${GAP}' @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
    const detail = detailOf(page);
    const figure = detail.locator("figure").first();
    const bridge = figure.locator("path[data-bridge]");
    await expect(figure.locator("path.k-draw")).toBeVisible();
    // 30일: every day is there (the mock's 5-day hole is older): no bridge, no count.
    await expect(bridge).toHaveCount(0);
    await expect(countOf(detail)).toHaveCount(0);
    const ranges = detail.getByRole("group", { name: "기간" });
    const moved = await shiftsDuring(page, () => ranges.getByRole("button", { name: "3개월" }).click(), 1500);
    await expect(countOf(detail)).toHaveText("3개월 중 39일치 기록");
    expect(moved.all, `3개월 전환 흔들림 (${moved.moved})`).toBe(0);
    // One hole, one bridge: dashed, thinner than the line and not its colour.
    await expect(bridge).toHaveAttribute("data-bridge", "1");
    const look = await bridge.evaluate((path) => {
      const line = path.ownerSVGElement.querySelector("path.k-draw");
      const a = getComputedStyle(path);
      const b = getComputedStyle(line);
      return { dash: a.strokeDasharray, width: Number.parseFloat(a.strokeWidth), lineWidth: Number.parseFloat(b.strokeWidth), stroke: a.stroke, lineStroke: b.stroke };
    });
    expect(look.dash, "점선").not.toBe("none");
    expect(look.width, "선보다 가늘다").toBeLessThan(look.lineWidth);
    expect(look.stroke, "선 색이 아니다").not.toBe(look.lineStroke);
    // The count sits in the head with the period buttons, above the chart.
    const count = await countOf(detail).boundingBox();
    const chart = await figure.boundingBox();
    expect(count.y + count.height, "기록 줄은 차트 위").toBeLessThanOrEqual(chart.y);
    // Over the hole (the bridge's middle): the day and the gap text, in the tooltip and the readout.
    const span = await bridge.boundingBox();
    await page.mouse.move(span.x + span.width / 2, span.y + span.height / 2);
    await expect(page.locator("[data-gap-tip]")).toHaveText(new RegExp(`^\\d+/\\d+ · ${GAP}$`));
    await expect(figure.locator("p[aria-live]")).toContainText(GAP);
    await expect(figure.locator("p[aria-live] strong")).toHaveText("—");
    // Back on a day with a record, its price again.
    await page.mouse.move(chart.x + chart.width - 70, span.y);
    await expect(page.locator("[data-gap-tip]")).toHaveCount(0);
    await expect(figure.locator("p[aria-live] strong")).toHaveText(/G$/);
    await expectNoHorizontalOverflow(page);
  });

test(`키보드 ← 는 빈 날에도 멈추고 '${GAP}'를 읽는다 @regression`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK&range=90d");
  const detail = detailOf(page);
  await expect(countOf(detail)).toHaveText("3개월 중 39일치 기록");
  const svg = detail.locator("figure svg").first();
  const readout = detail.locator("figure p[aria-live]").first();
  await svg.focus();
  // One step per calendar day from the newest completed day: the hole is 20–24 days back.
  const seen = [];
  let before = await readout.textContent();
  for (let i = 0; i < 26; i++) {
    await svg.press("ArrowLeft");
    // Every day reads its own date: wait for this step's line (a retrying check), then read it.
    await expect(readout).not.toHaveText(before);
    before = await readout.textContent();
    seen.push(before.includes(GAP));
  }
  // One step per day: exactly the hole's five days read as having no record, in a row.
  expect(seen.filter(Boolean).length, "빈 날 수(구멍 5일)").toBe(5);
  expect(seen.join(""), "빈 날은 이어서").toContain("true".repeat(5));
});

for (const width of [320, 1280])
  test(`${width}: 보석 칸 빈 날 둘이면 점선 둘, 'N일 중 M일치 기록'은 제목 아래 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await dropDays(page, /\/api\/markets\/auctions\/gems\/history/, [4, 6]);
    await gotoReady(page, "/market/gems?kind=겁화&level=10");
    const box = page.getByRole("region", { name: "10레벨 겁화 최저가 추이" });
    const bridge = box.locator("path[data-bridge]");
    await expect(bridge).toHaveAttribute("data-bridge", "2");
    await expect(box.locator("circle[data-lone]")).toHaveCount(1);
    const count = countOf(box);
    await expect(count).toHaveText("30일 중 27일치 기록");
    const head = await box.getByRole("heading", { name: "최저가 추이" }).boundingBox();
    const at = await count.boundingBox();
    const chart = await box.locator("figure").boundingBox();
    expect(at.y, "제목 아래").toBeGreaterThanOrEqual(head.y + head.height - 1);
    expect(at.y + at.height, "차트 위").toBeLessThanOrEqual(chart.y);
    // Gems have no note line: the gap text is enough there.
    await expect(box.locator("[data-gap-note]")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

// codex 재검토 P3(#1788, PM 총괄 11-21 18:14): 320에서 차트 양 끝 빈 날의 안내 칸('이날은 기록이 없어요')이
// 화면 밖으로 나갔다. 끝에 가장 가까운 빈 날 — 오른쪽(위치 2: 1은 가장 최근 완료일이라 빼면 끝이 짧아질 뿐)과 왼쪽(위치 27: 28이 가장 오래된 기록) — 에서 칸이 차트와 창 안에,
// 가로 넘침 없이, 키보드로 하루씩 옮기는 동안 흔들림 0.
test(`320: 차트 양 끝 빈 날에서도 '${GAP}' 칸은 차트와 화면 안 @regression`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await watchShifts(page);
  await dropDays(page, /\/api\/markets\/auctions\/gems\/history/, [2, 27]);
  await gotoReady(page, "/market/gems?kind=겁화&level=10");
  const box = page.getByRole("region", { name: "10레벨 겁화 최저가 추이" });
  await expect(box.locator("path[data-bridge]")).toHaveAttribute("data-bridge", "2");
  const figure = box.locator("figure").first();
  const svg = figure.locator("svg").first();
  const readout = figure.locator("p[aria-live]").first();
  const tip = page.locator("[data-gap-tip]");
  await svg.focus();
  const seen = [];
  const moved = await shiftsDuring(
    page,
    async () => {
      let before = await readout.textContent();
      // From the newest completed day back to the oldest (← stops there): both gap days on the way.
      for (let i = 0; i < 40; i++) {
        await svg.press("ArrowLeft");
        const moved = await expect(readout)
          .not.toHaveText(before, { timeout: 1500 })
          .then(() => true, () => false);
        if (!moved) break;
        before = await readout.textContent();
        if (!before.includes(GAP)) continue;
        await expect(tip).toHaveCount(1);
        const card = await tip.evaluate((el) => {
          const r = (el.closest("[data-slot=chart-tooltip]") ?? el).getBoundingClientRect();
          return { left: r.left, right: r.right, width: innerWidth };
        });
        const chart = await figure.boundingBox();
        seen.push({ step: i + 1, ...card, chartLeft: chart.x, chartRight: chart.x + chart.width });
      }
    },
    600,
  );
  // Two gap days, one at each end.
  expect(seen.length, "빈 날 둘").toBe(2);
  for (const s of seen) {
    expect(s.left, `${s.step}번째 날: 칸 왼쪽이 차트 안`).toBeGreaterThanOrEqual(s.chartLeft - 0.5);
    expect(s.right, `${s.step}번째 날: 칸 오른쪽이 차트 안`).toBeLessThanOrEqual(s.chartRight + 0.5);
    expect(s.left, "창 안").toBeGreaterThanOrEqual(0);
    expect(s.right, "창 안").toBeLessThanOrEqual(s.width);
  }
  expect(moved.all, `흔들림 (${moved.moved})`).toBe(0);
  await expectNoHorizontalOverflow(page);
});

const ACCESSORY_HISTORY = /\/api\/markets\/auctions\/accessories\/history/;
// 품질 90은 워밍업이 채우지 않는 칸(기본 필터는 고대 · 딜러 · 품질 70).
const UNWARMED = "/market/accessories?slot=NECKLACE&levels=HIGH,HIGH&minQuality=90";
const WARMED = "/market/accessories?slot=NECKLACE&levels=HIGH,HIGH";

test("장신구 칸에 빈 날이 있으면 조회한 날만 기록된다고 한 줄, 없으면 자리만 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await gotoReady(page, UNWARMED);
  const box = page.getByRole("region", { name: /최저가 추이$/ });
  const note = box.locator("[data-gap-note]");
  await expect(box.locator("figure svg path.k-draw")).toBeVisible();
  // 30일 without a missing day: the line is held, empty.
  await expect(box.locator("path[data-bridge]")).toHaveCount(0);
  await expect(note).toHaveCount(1);
  await expect(note).toHaveText(/^\s*$/);
  const held = await note.boundingBox();
  await dropDays(page, ACCESSORY_HISTORY, [3, 4]);
  await gotoReady(page, UNWARMED);
  await expect(box.locator("path[data-bridge]")).toHaveAttribute("data-bridge", "1");
  await expect(note).toHaveText("이 칸은 누가 조회한 날만 기록돼요");
  expect((await note.boundingBox()).height, "한 줄 자리 그대로").toBe(held.height);
});

// 워밍업 시작일(lib/market/warmup-since.ts, 2026-11-20)을 고정 날짜로 둔다. 날짜를 다시 매겨 오늘과 상관없이 본다.
for (const width of [320, 360])
  test(`${width}: 워밍업 칸은 시작일 전 빈 날만 날짜와 함께 한 줄, 뒤 빈 날은 줄 없이 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, WARMED);
    const box = page.getByRole("region", { name: /최저가 추이$/ });
    const note = box.locator("[data-gap-note]");
    await expect(box.locator("figure svg path.k-draw")).toBeVisible();
    const held = await note.boundingBox();
    // 11-25부터 거꾸로: 위치 6·7 = 11-19·11-18(시작 전).
    await dropDays(page, ACCESSORY_HISTORY, [6, 7], "2026-11-25");
    await gotoReady(page, WARMED);
    await expect(box.locator("path[data-bridge]")).toHaveAttribute("data-bridge", "1");
    await expect(note).toHaveText("이 칸은 11/20 전에는 누가 조회한 날만 기록돼요");
    expect((await note.boundingBox()).height, "한 줄 자리 그대로").toBe(held.height);
    await expectNoHorizontalOverflow(page);
    // 위치 2·3 = 11-23·11-22(시작 뒤): 빈 날은 점선과 '이날은 기록이 없어요'로 충분, 줄은 비운 채 자리만.
    await page.unroute(ACCESSORY_HISTORY);
    await dropDays(page, ACCESSORY_HISTORY, [2, 3], "2026-11-25");
    await gotoReady(page, WARMED);
    await expect(box.locator("path[data-bridge]")).toHaveAttribute("data-bridge", "1");
    await expect(note).toHaveText(/^\s*$/);
    expect((await note.boundingBox()).height, "자리 그대로").toBe(held.height);
  });
