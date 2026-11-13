// 빈틈 #3 지옥 · 나락 보상: 열쇠 하나로 보이는 상자 가운데 하나를 연다(PM 총괄 11-10). 상자마다 그 안의 보상
// (+ 기본 보상)을 시세(목 서버의 합성 값)와 직접 정한 값으로 매겨 좋은 순으로 보이고, 맨 위가 '가장 좋은 상자'.
// 목 시세: 빙하의 숨결 430G, 용암의 숨결 없음, 결정 9G · 수호석 결정 1.9G · 위대한 돌파석 33G · 상급 융화 271G,
// 전이 돌파석 · 운명/혼돈의 돌 없음, 운명의 파편 0.077333G.
// 지옥 1730 · 1750 · 0단계 기본 보상: 파편 5,200 × 0.077333 + 결정 26 × 9 + 수호석 결정 170 × 1.9 + 위대한 4 × 33 = 1,091.13.
import { test, expect, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360, 320])
  test(`${width} 지옥 · 나락 보상: 상자 하나 · 가장 좋은 상자 · 직접 정한 값 · 단계표, 흔들림 0 @regression @smoke`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto("/tools/hell-reward");
    await expect(page.getByRole("heading", { level: 1, name: "지옥 · 나락 보상" })).toBeVisible();
    const head = page.locator("dl").filter({ hasText: "가장 좋은 상자" });
    const bestName = head.getByRole("definition").nth(0);
    const bestValue = head.getByRole("definition").nth(1);
    const list = page.getByRole("list", { name: "상자별 값(좋은 순)" });
    const box = (name) => list.locator(":scope > li").filter({ hasText: name });
    const line = (name) => list.locator("ul > li").filter({ hasText: name });

    // 지옥 1750 · 0단계: 상자마다 그 안 + 기본 보상. 융화 75 × 271 + 1,091 = 21,416 > 재련 보조(빙하 36 × 430
    // + 1,091 = 16,571, 용암 시세 없음) > 귀속 골드 5,500 + 1,091 = 6,591. 모든 상자의 합이 아니다.
    await expect(bestName).toHaveText("융화 재료 상자");
    await expect(bestValue).toHaveText("21,416G");
    await expect(list.locator(":scope > li").first()).toContainText("융화 재료 상자");
    await expect(box("재련 보조 상자")).toContainText("16,571G");
    await expect(box("귀속 골드 상자")).toContainText("6,591G");
    await expect(head.getByRole("definition").nth(2)).toHaveText("1,091G");
    await expect(page.getByText("어느 상자를 열어도 기본 보상이 같이 나와요.")).toBeVisible();
    // 0G로 센 직접 값 품목: 용암 · 전이 돌파석 · 운명/혼돈의 돌 중 센 하나 · 스톤 키트 · 팔찌 · 젬.
    await expect(page.getByText("직접 값 없이 0G로 센 품목 6개")).toBeVisible();
    await expect(line("운명의 파괴석 결정")).toContainText("거래 가능 여부 확인 전");
    // The price time line (codex QA v0.3.11 P2): mock prices are fresh.
    await expect(page.getByText(/^시세 (방금|\d+분 전) 수집$/)).toBeVisible();
    // Fresh prices: no old-price marker by the headline value (QA 11-13 08시).
    await expect(bestValue.locator("span")).toHaveText("");
    await page.waitForTimeout(600);
    const first = await shiftsSince(page);
    expect(first.all, `시세 도착 흔들림 (${first.moved})`).toBe(0);
    // 시세 기준을 바꿔도 상자 순서는 그대로, 값만 바뀐다(새 시세가 늦게 와도 움직이지 않음, PM-프론트 #1530 P2).
    const order = await list.locator(":scope > li > p strong").allInnerTexts();
    const mark = await page.evaluate(() => performance.now());
    await chooseOption(page, page.getByRole("combobox", { name: "시세 기준" }), "현재 최저가");
    await expect(page.locator("[data-stale]")).toHaveCount(0);
    await page.waitForTimeout(1200);
    const switched = await shiftsSince(page, mark);
    expect(switched.all, `시세 기준 전환 흔들림 (${switched.moved})`).toBe(0);
    expect(await list.locator(":scope > li > p strong").allInnerTexts()).toEqual(order);
    // 머리글은 늘 지금 값의 가장 좋은 상자, 순서 안내와 다시 정렬 단추는 처음부터 있다.
    await expect(bestName).toHaveText(order[0]);
    const note = page.getByText("지금 값 기준으로 좋은 순서예요.", { exact: true });
    await expect(note).toBeVisible();
    // The stale text (any pair out of order, codex #1536) keeps the line's height at every width:
    // swap the text node's value in place, compare, put it back.
    const noteHeight = () => note.evaluate((el) => el.getBoundingClientRect().height);
    const calm = await noteHeight();
    const staleHeight = await note.evaluate((el) => {
      const node = el.firstChild;
      const was = node.nodeValue;
      node.nodeValue = "시세가 바뀌어 지금 값과 순서가 달라요.";
      const h = el.getBoundingClientRect().height;
      node.nodeValue = was;
      return h;
    });
    expect(staleHeight, "stale 문구 높이").toBe(calm);
    await page.getByRole("button", { name: "지금 시세로 다시 정렬" }).click();
    expect(await list.locator(":scope > li > p strong").allInnerTexts()).toEqual(order);

    // 직접 정한 값은 그 품목의 상자에만: 고대 팔찌 1개 100G → 팔찌 상자 400 + 1,091, 용암 1개 10G → 재련 보조 16,691.
    await page.getByRole("spinbutton", { name: "팔찌 상자 (고대) 1개 값(골드)" }).fill("100");
    await expect(box("팔찌 상자")).toContainText("1,491G");
    await page.getByRole("spinbutton", { name: "용암의 숨결 1개 값(골드)" }).fill("10");
    await expect(box("재련 보조 상자")).toContainText("16,691G");
    await expect(bestValue).toHaveText("21,416G");
    await expect(page.getByText("직접 값 없이 0G로 센 품목 4개")).toBeVisible();

    // 나락 1750 · 0단계: 나락 상자에는 기본 보상이 없다. 재련 보조(용암 60 × 10 + 빙하 180 × 430 = 78,000)가 가장 좋다.
    await page.getByRole("radiogroup", { name: "종류" }).getByRole("radio", { name: "나락" }).click();
    await expect(head.getByRole("definition").nth(2)).toHaveText("없음");
    await expect(page.getByText("나락 상자에는 기본 보상이 없어요.")).toBeVisible();
    await expect(page.getByRole("switch", { name: "풍요(기본 보상 ×10)" })).toBeDisabled();
    await expect(bestName).toHaveText("재련 보조 상자");
    await expect(bestValue).toHaveText("78,000G");
    await expect(box("귀속 골드 상자")).toContainText("27,500G");
    // 운명/혼돈의 돌 상자는 둘 중 하나: 운명의 돌 45 × 2 = 90.
    await page.getByRole("spinbutton", { name: "운명의 돌 1개 값(골드)" }).fill("2");
    await expect(box("운명 · 혼돈의 돌 상자")).toContainText("90G");
    await expect(line("혼돈의 돌")).toContainText("셈 안 함");

    // 지옥 1730: 재료 넷은 게임 안 기록에 (귀속) → '귀속, 시세로 환산'. 융화 60 × 271 + 1,091 = 17,351이 가장 좋다.
    await page.getByRole("radiogroup", { name: "종류" }).getByRole("radio", { name: "지옥" }).click();
    await page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: "1730" }).click();
    await expect(line("운명의 파괴석 결정")).toContainText("귀속, 시세로 환산");
    await expect(bestName).toHaveText("융화 재료 상자");
    await expect(bestValue).toHaveText("17,351G");
    // 풍요는 기본 보상만 ×10: 1,091.13 × 10 = 10,911 → 융화 16,260 + 10,911 = 27,171.
    await page.getByRole("switch", { name: "풍요(기본 보상 ×10)" }).check();
    await expect(head.getByRole("definition").nth(2)).toHaveText("10,911G");
    await expect(bestValue).toHaveText("27,171G");
    // 고른 종류 · 열쇠 단계는 주소에 남아 다시 열어도 그대로(#889).
    await expect(page).toHaveURL(/level=1730/);
    await page.reload();
    await expect(page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: "1730" })).toBeChecked();
    // 단계표 11줄은 단계마다 가장 좋은 상자의 값.
    await chooseOption(page, page.getByRole("combobox", { name: "클리어 단계" }), "10단계");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(12);
    await expect(table.locator("tr[aria-current]")).toContainText("10단계");
    await expectNoHorizontalOverflow(page);
  });

// codex QA v0.3.11 P1: the tool kept nothing; reload / Back dropped 풍요 and the typed values and the
// best box changed. 종류 · 열쇠 단계 · 클리어 단계 · 풍요 · 시세 기준 live in the address (replaceState),
// typed values in this browser (by item name). Coming back shows the same values and best box, still.
for (const width of [1280, 320])
  test(`${width} 지옥 · 나락 보상: 새로 고침과 뒤로 가기 뒤에도 고른 것 · 직접 정한 값 · 가장 좋은 상자 그대로, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto("/tools/hell-reward");
    const head = page.locator("dl").filter({ hasText: "가장 좋은 상자" });
    const bestName = head.getByRole("definition").nth(0);
    const bestValue = head.getByRole("definition").nth(1);
    const abundance = page.getByRole("switch", { name: "풍요(기본 보상 ×10)" });
    const bracelet = page.getByRole("spinbutton", { name: "팔찌 상자 (고대) 1개 값(골드)" });
    const lava = page.getByRole("spinbutton", { name: "용암의 숨결 1개 값(골드)" });
    const basis = page.getByRole("combobox", { name: "시세 기준" });
    await expect(bestValue).toHaveText("21,416G");

    await page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: "1730" }).click();
    await chooseOption(page, page.getByRole("combobox", { name: "클리어 단계" }), "3단계");
    await abundance.check();
    await chooseOption(page, basis, "현재 최저가");
    await expect(page.locator("[data-stale]")).toHaveCount(0);
    await bracelet.fill("100000");
    await lava.fill("50");
    await expect(page).toHaveURL(/abundance=1/);
    await expect(page).toHaveURL(/basis=CURRENT_MIN_PRICE/);
    const name = await bestName.innerText();
    const amount = await bestValue.innerText();
    // A value typed this high puts the 팔찌 box on top: the best box itself depends on a typed value.
    expect(name).toBe("팔찌 상자");

    const same = async (when) => {
      await expect(bestName, when).toHaveText(name);
      await expect(bestValue, when).toHaveText(amount);
      await expect(abundance, when).toBeChecked();
      await expect(bracelet, when).toHaveValue("100000");
      await expect(lava, when).toHaveValue("50");
      await expect(basis, when).toContainText("현재 최저가");
      await expect(page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: "1730" }), when).toBeChecked();
      await expect(page.getByRole("combobox", { name: "클리어 단계" }), when).toContainText("3단계");
    };
    // codex #1549 P3: while the page comes back, the headline never shows another box or value
    // (no flip from a no-typed-value result): every shown (visible) headline text is recorded.
    await page.addInitScript(() => {
      window.__headSeen = new Set();
      const look = () => {
        const dl = [...document.querySelectorAll("dl")].find((d) => d.textContent.includes("가장 좋은 상자"));
        const dds = dl ? [...dl.querySelectorAll("dd")] : [];
        if (dds.length > 1 && getComputedStyle(dds[1]).visibility === "visible")
          window.__headSeen.add(`${dds[0].textContent}|${dds[1].textContent}`);
      };
      new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    await page.reload();
    await same("새로 고침");
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => [...window.__headSeen]), "새로 고침 중 머리글").toEqual([`${name}|${amount}`]);
    const reloaded = await shiftsSince(page);
    expect(reloaded.all, `새로 고침 뒤 흔들림 (${reloaded.moved})`).toBe(0);

    await page.goto("/");
    await page.goBack();
    await same("뒤로 가기");
    await page.waitForTimeout(600);
    const back = await shiftsSince(page);
    expect(back.all, `뒤로 가기 뒤 흔들림 (${back.moved})`).toBe(0);
  });

// codex QA v0.3.11 P2: the tool said nothing about when its prices were collected, even when they
// were days old. The line under 시세 기준 names the collection time; past an hour it reads as old
// (warning tone). It keeps one line either way, so nothing moves. 901: the narrowest side column
// (16rem, ~901–1000 px), where the longest form (hours) must still fit one line (codex #1559 P3).
for (const width of [1280, 901, 360, 320])
  test(`${width} 지옥 · 나락 보상: 시세 수집 시각, 오래된 시세는 오래됐다고, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    // Every price answer aged 3 days (the web's own /api answer, { ok, envelope }).
    const old = new Date(Date.now() - 3 * 24 * 3_600_000);
    await page.route("**/api/markets/material-prices", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      for (const item of body.envelope?.data?.items ?? []) item.observedAt = old.toISOString();
      await route.fulfill({ response, json: body });
    });
    await page.goto("/tools/hell-reward");
    const kst = new Date(old.getTime() + 9 * 3_600_000);
    const hm = `${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
    const line = page.getByText(`오래된 시세 · 3일 전(${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${hm})`, { exact: true });
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute("data-old", "true");
    // Old, longest (the hours form) or fresh, the line is one line high and never wider than its box.
    const oneLine = await line.evaluate((el) => {
      const node = el.firstChild;
      const was = node.nodeValue;
      const old = el.getBoundingClientRect().height;
      node.nodeValue = "오래된 시세 · 23시간 전(12월 31일 23:59)";
      const longest = el.getBoundingClientRect().height;
      const overflow = el.scrollWidth - el.clientWidth;
      node.nodeValue = "시세 3분 전 수집";
      const fresh = el.getBoundingClientRect().height;
      node.nodeValue = was;
      return { old, longest, fresh, overflow, line: parseFloat(getComputedStyle(el).lineHeight) };
    });
    expect(oneLine.old, "오래된 시세 줄 높이").toBe(oneLine.fresh);
    expect(oneLine.longest, "가장 긴 문구 줄 높이").toBe(oneLine.fresh);
    expect(oneLine.old, "한 줄").toBeLessThan(oneLine.line * 1.5);
    expect(oneLine.overflow, "가장 긴 문구 넘침").toBeLessThanOrEqual(0);
    // QA 11-13 08시: the line above sits screens below the values on a phone, so the headline value
    // says it too. One line in the room the two-line box name leaves: the longest form never wraps,
    // never spills, and never grows the headline row.
    const head = page.locator("dl").filter({ hasText: "가장 좋은 상자" });
    const marker = head.getByRole("definition").nth(1).locator("span");
    await expect(marker).toHaveText("3일 전 시세");
    await expect(marker).toBeInViewport();
    const fits = await marker.evaluate((el) => {
      const dd = el.parentElement;
      const name = dd.closest("dl").querySelector("dd");
      const node = el.firstChild;
      const was = node.nodeValue;
      node.nodeValue = "23시간 전 시세";
      const r = {
        height: el.getBoundingClientRect().height,
        line: parseFloat(getComputedStyle(el).lineHeight),
        overflow: el.scrollWidth - el.clientWidth,
        spill: dd.getBoundingClientRect().right - dd.parentElement.getBoundingClientRect().right,
        below: dd.getBoundingClientRect().bottom - name.getBoundingClientRect().bottom,
        color: getComputedStyle(el).color !== getComputedStyle(dd).color,
      };
      node.nodeValue = was;
      return r;
    });
    expect(fits.height, "표시 한 줄").toBeLessThan(fits.line * 1.5);
    expect(fits.overflow, "표시 넘침").toBeLessThanOrEqual(0);
    expect(fits.spill, "표시가 칸 밖으로").toBeLessThanOrEqual(0);
    expect(fits.below, "머리글 줄이 길어짐").toBeLessThanOrEqual(0);
    expect(fits.color, "경고 색").toBe(true);
    await page.waitForTimeout(600);
    const shifts = await shiftsSince(page);
    expect(shifts.all, `시세 시각 흔들림 (${shifts.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

// QA 11-13 01시 (P2): typing a value re-ranked the list on every keystroke: 100000 into the 팔찌 box
// jumped it 7th -> 1st in three steps and scrolled the page 942 px at 360, and deleting left the field
// half cut under the keyboard. While a value field has focus the order holds (the headline still
// updates live); Enter or leaving the field re-ranks.
for (const [width, height] of [
  [360, 740],
  [1280, 800],
])
  test(`${width} 지옥 · 나락 보상: 값을 입력하는 동안 상자 순서 그대로, 화면 안 움직임, 입력을 마치면 다시 정렬 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/tools/hell-reward");
    const head = page.locator("dl").filter({ hasText: "가장 좋은 상자" });
    const bestName = head.getByRole("definition").nth(0);
    const list = page.getByRole("list", { name: "상자별 값(좋은 순)" });
    const names = () => list.locator(":scope > li > p strong").allInnerTexts();
    const field = page.getByRole("spinbutton", { name: "팔찌 상자 (고대) 1개 값(골드)" });
    await expect(head.getByRole("definition").nth(1)).toHaveText("21,416G");
    const order = await names();
    expect(order[0]).toBe("융화 재료 상자");
    expect(order.indexOf("팔찌 상자")).toBeGreaterThan(0);
    await field.scrollIntoViewIfNeeded();
    await field.click();
    const where = () => field.evaluate((el) => ({ y: window.scrollY, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, vh: window.innerHeight }));
    const start = await where();
    const held = async (when) => {
      expect(await names(), `${when}: 순서`).toEqual(order);
      const now = await where();
      expect(now.y, `${when}: 화면 이동`).toBe(start.y);
      expect(now.top, `${when}: 입력 칸 위치`).toBe(start.top);
      expect(now.top, `${when}: 입력 칸 위`).toBeGreaterThanOrEqual(0);
      expect(now.bottom, `${when}: 입력 칸 아래`).toBeLessThanOrEqual(now.vh);
    };
    // Each check waits for the typed value first: the value and any re-rank land in one render.
    let typed = "";
    for (const digit of "100000") {
      await page.keyboard.type(digit);
      typed += digit;
      await expect(field).toHaveValue(typed);
      await held(`'${typed}' 입력`);
    }
    // The headline is the best box now (100000 × 4 + 1,091), the list says it re-sorts when typing ends.
    await expect(bestName).toHaveText("팔찌 상자");
    await expect(page.getByText("입력을 마치면 값 순서로 다시 정렬해요.", { exact: true })).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Backspace");
      await expect(field).toHaveValue("100000".slice(0, 5 - i));
      await held(`지우기 ${i + 1}`);
    }
    await expect(field).toHaveValue("10");
    await page.keyboard.type("0000");
    await expect(field).toHaveValue("100000");
    await held("다시 입력");
    // Enter re-ranks: the 팔찌 box first.
    await page.keyboard.press("Enter");
    await expect.poll(names).not.toEqual(order);
    expect((await names())[0]).toBe("팔찌 상자");
    await expect(page.getByText("지금 값 기준으로 좋은 순서예요.", { exact: true })).toBeVisible();
    // The box moved with the field in it: the field keeps focus and is brought back into view, fully
    // below the sticky site bar, with no help from the test (codex #1574 P2).
    await expect(field).toBeFocused();
    await expect
      .poll(() =>
        field.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const bar = document.querySelector("header").getBoundingClientRect().bottom;
          return r.top >= bar && r.bottom <= window.innerHeight;
        }),
      )
      .toBe(true);
    // Typing on holds again (still in the field); leaving it re-ranks (1 → the 팔찌 box drops back).
    const ranked = await names();
    for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
    await expect(field).toHaveValue("1");
    expect(await names(), "지우는 동안 순서").toEqual(ranked);
    await expect(bestName).toHaveText("융화 재료 상자");
    await page.getByRole("heading", { level: 1 }).click();
    await expect.poll(async () => (await names())[0]).toBe("융화 재료 상자");
    await expectNoHorizontalOverflow(page);
  });

// codex #1574 P2: (1) a price landing for a '시세 없음' item removes its value field; a removed field fires
// no blur, so typing must end there (no held order, no '입력을 마치면…' line left behind). (2) A value
// field focused with nothing typed: a price change that reorders reads as a price change. The one-
// minute refresh is run on the page clock; the price answer is the web's own ({ ok, envelope }).
async function pricesWith(page, prices) {
  await page.route("**/api/markets/material-prices", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const item of body.envelope?.data?.items ?? [])
      if (item.name in prices) Object.assign(item, { status: "PRICED", unitPriceGold: prices[item.name] });
    await route.fulfill({ response, json: body });
  });
}
const orderNote = (page) => page.locator("p").filter({ has: page.getByRole("button", { name: "지금 시세로 다시 정렬" }) }).locator("span");

test("1280 지옥 · 나락 보상: 입력 중 시세가 와 값 칸이 사라지면 입력이 끝남, 순서 · 문구가 남지 않음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install();
  const prices = {};
  await pricesWith(page, prices);
  await page.goto("/tools/hell-reward");
  const head = page.locator("dl").filter({ hasText: "가장 좋은 상자" });
  const list = page.getByRole("list", { name: "상자별 값(좋은 순)" });
  const names = () => list.locator(":scope > li > p strong").allInnerTexts();
  await expect(head.getByRole("definition").nth(1)).toHaveText("21,416G");
  const order = await names();
  expect(order[0]).toBe("융화 재료 상자");
  // 용암 has no price: its value field. 100000 typed: 재련 보조 is the best box now, the order held.
  const lava = page.getByRole("spinbutton", { name: "용암의 숨결 1개 값(골드)" });
  await lava.click();
  await page.keyboard.type("100000");
  await expect(head.getByRole("definition").nth(0)).toHaveText("재련 보조 상자");
  await expect(orderNote(page)).toHaveText("입력을 마치면 값 순서로 다시 정렬해요.");
  expect(await names()).toEqual(order);
  // The refresh brings a 용암 price (1,000G) while the field has focus: the field goes.
  prices["용암의 숨결"] = 1000;
  await page.clock.runFor(61_000);
  await expect(lava).toHaveCount(0);
  // Typing ended: the list follows the values now (재련 보조 16,571 + 12 × 1,000 first), plain line.
  await expect.poll(async () => (await names())[0]).toBe("재련 보조 상자");
  await expect(orderNote(page)).toHaveText("지금 값 기준으로 좋은 순서예요.");
});

test("1280 지옥 · 나락 보상: 값 칸에 있어도 입력하지 않았으면 시세로 바뀐 순서는 시세 문구 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install();
  const prices = {};
  await pricesWith(page, prices);
  await page.goto("/tools/hell-reward");
  const head = page.locator("dl").filter({ hasText: "가장 좋은 상자" });
  const list = page.getByRole("list", { name: "상자별 값(좋은 순)" });
  const names = () => list.locator(":scope > li > p strong").allInnerTexts();
  await expect(head.getByRole("definition").nth(1)).toHaveText("21,416G");
  const order = await names();
  // In the 팔찌 field, nothing typed; the refresh brings a 용암 price that puts 재련 보조 on top.
  const bracelet = page.getByRole("spinbutton", { name: "팔찌 상자 (고대) 1개 값(골드)" });
  await bracelet.click();
  prices["용암의 숨결"] = 1000;
  await page.clock.runFor(61_000);
  await expect(head.getByRole("definition").nth(0)).toHaveText("재련 보조 상자");
  // The order is held (prices never reorder by themselves) and the line says why: prices, not typing.
  expect(await names()).toEqual(order);
  await expect(orderNote(page)).toHaveText("시세가 바뀌어 지금 값과 순서가 달라요.");
  await expect(bracelet).toBeFocused();
});
