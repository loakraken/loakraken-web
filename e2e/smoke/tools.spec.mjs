// 성장 도구 3종: 재련 기대 비용, 재료 구매 견적, 치적·뭉가·음돌.
// 모든 수치는 목 서버의 합성 값이라 값 자체가 아니라 흐름과 상태를 확인한다.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test.describe("재련 기대 비용 @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/refining");
    await expect(page.getByRole("heading", { level: 1, name: "재련 기대 비용" })).toBeVisible();
  });

  test("모든 부위 목표를 고르면 바로 계산한다", async ({ page }) => {
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    // 6부위 × (+18 → +20) = 12단계
    // 결론 카드(맨 위)와 결과 영역이 같은 단계 수를 보여 준다(피아식별 심각 2).
    await expect(page.getByRole("region", { name: /목표까지 예상 비용/ }).getByText(/총 12단계/)).toBeVisible();
    await expect(page.getByRole("region", { name: "예상 소모" }).getByText(/총 12단계/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "필요 재료" }).or(page.getByText("필요 재료")).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("책 효과는 기본으로 넣고, 끄면 값과 가정 문장이 바뀐다", async ({ page }) => {
    // PM 총괄 10-11 00:20 결정 ②: 책 기본 포함.
    const weaponBook = page.getByRole("switch", { name: /무기 책 효과 적용/ });
    const armorBook = page.getByRole("switch", { name: /방어구 책 효과 적용/ });
    await expect(weaponBook).toBeChecked();
    await expect(armorBook).toBeChecked();
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    const result = page.getByRole("region", { name: "예상 소모" });
    await expect(result.getByText(/책\(야금술·재봉술\) 효과가 매번 적용된다고 가정했어요/)).toBeVisible();
    const total = page.getByRole("region", { name: /목표까지 예상 비용/ }).locator("[class*=topTotal]");
    await expect(total).toBeVisible();
    const withBooks = await total.innerText();
    // The switch covers its whole row (A36), so it is pressed as the switch.
    await page.getByRole("switch", { name: /^무기 책 효과 적용/ }).click();
    await page.getByRole("switch", { name: /^방어구 책 효과 적용/ }).click();
    await expect(total).not.toHaveText(withBooks);
    await expect(result.getByText(/효과가 매번 적용된다고 가정했어요/)).toHaveCount(0);
  });

  test("캐릭터 장비를 불러와 현재 단계를 채운다", async ({ page }) => {
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("재련");
    await page.getByRole("button", { name: "장비 불러오기" }).click();
    await expect(page.getByText(/재련 · 루페온 · 아이템 레벨 1,738\.33/)).toBeVisible();
    await expect(page.getByRole("group", { name: "무기" }).getByRole("combobox", { name: "현재" })).toHaveText("+21");
    // 업화·전율이 아닌 어깨는 계산에서 빠진다.
    await expect(page.getByText(/어깨 부위는 업화·전율 장비가 아니거나/)).toBeVisible();
  });
});

test.describe("재료 구매 견적 @smoke", () => {
  test("카테고리는 묶음 알약 탭과 분류 칩이고, 고른 분류는 주소로 남는다", async ({ page }) => {
    // 사용자 10-11 00:04: 기본 드롭다운 대신 공통 알약 탭(web #417).
    await page.goto("/tools/material-quote");
    const tabs = page.getByRole("tablist", { name: "카테고리" });
    await expect(tabs).toBeVisible();
    const selected = tabs.getByRole("tab", { selected: true });
    await expect(selected).toHaveCount(1);
    const group = await selected.innerText();
    const chips = page.getByRole("group", { name: `${group} 분류` });
    await expect(chips.getByRole("button", { name: "전체", pressed: true })).toBeVisible();
    const kindName = await chips.getByRole("button", { pressed: false }).first().innerText();
    const kind = chips.getByRole("button", { name: kindName });
    await kind.click();
    await expect(kind).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]category=\d+/);
    await page.reload();
    await expect(page.getByRole("group", { name: `${group} 분류` }).getByRole("button", { name: kindName })).toHaveAttribute("aria-pressed", "true");
    // 키보드: 화살표로 다음 묶음.
    await page.getByRole("tablist", { name: "카테고리" }).getByRole("tab", { selected: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tablist", { name: "카테고리" }).getByRole("tab", { selected: true })).not.toHaveText(group);
  });

  test("검색한 재료를 넣고 견적을 계산한다", async ({ page }) => {
    await page.goto("/tools/material-quote");
    const compute = page.getByRole("button", { name: "견적 계산" });
    await expect(compute).toBeDisabled();
    // 카테고리 목록이 도착하면 묶음 탭이 나온다(도착 전 검색은 regression/material-quote-options).
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();

    await page.getByRole("combobox", { name: "재료 이름" }).fill("합성");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await page.getByRole("option", { name: "합성 재련 재료 견적에 추가" }).click();
    await expect(page.getByRole("heading", { name: "재료 1/10" })).toBeVisible();

    await page.getByRole("textbox", { name: "필요", exact: true }).fill("250");
    await page.getByRole("textbox", { name: "보유", exact: true }).fill("30");
    await expect(compute).toBeEnabled();
    await compute.click();
    // 부족 220개 → 100개 묶음 3개(300개), 묶음당 12골드 = 36골드
    await expect(page.getByText(/36/).first()).toBeVisible();
    await expect(page.getByText(/합성 재련 재료/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("재료 구매 견적 입력 중 검색 @smoke", () => {
  // 사용자 요청(10-16): Enter 없이 글자를 넣기만 해도 200ms 뒤 결과가 나온다. 앞 검색에 모든 결과가 다 왔으면
  // 글자를 더 넣을 때는 받은 목록을 화면에서 거르고 다시 요청하지 않는다. 키보드: ↑↓ 고르기, Enter 추가, Esc 닫기.
  test("글자만 넣어도 결과가 나오고, 좁혀 갈 때는 다시 요청하지 않으며, 키보드로 고른다", async ({ page }) => {
    const requests = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/markets/items")) requests.push(new URL(request.url()).searchParams.get("itemName"));
    });
    await page.goto("/tools/material-quote");
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
    const box = page.getByRole("combobox", { name: "재료 이름" });
    await box.pressSequentially("재련", { delay: 50 });
    const option = page.getByRole("option", { name: "합성 재련 재료 견적에 추가" });
    await expect(option).toBeVisible();
    await expect(box).toHaveAttribute("aria-expanded", "true");
    expect(requests).toEqual(["재련"]);

    // "재련 재료"는 "재련"의 결과(모두 받음) 안에서 거른다: 요청 없음.
    await box.pressSequentially(" 재료", { delay: 50 });
    await page.waitForTimeout(400);
    await expect(option).toBeVisible();
    expect(requests).toEqual(["재련"]);

    await box.press("ArrowDown");
    await expect(option).toHaveAttribute("aria-selected", "true");
    await expect(box).toHaveAttribute("aria-activedescendant", await option.getAttribute("id"));
    await box.press("Enter");
    await expect(page.getByRole("heading", { name: "재료 1/10" })).toBeVisible();
    await expect(page.getByRole("option", { name: "합성 재련 재료 추가됨" })).toHaveAttribute("aria-disabled", "true");

    await box.press("Escape");
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("listbox", { name: "검색 결과" })).toBeHidden();
    await box.press("ArrowDown");
    await expect(page.getByRole("listbox", { name: "검색 결과" })).toBeVisible();
  });
});

test.describe("재료 구매 견적 검색 결과 팝업 @smoke", () => {
  // PM-프론트 #855 P1: 결과는 디바운스와 응답 뒤에 나오므로 아래 내용을 밀면 입력과 떨어진 흔들림이 된다.
  // 결과는 입력칸 아래 떠 있는 목록이라 빠른 입력·느린 입력·지우기 모두 흔들림이 0이어야 한다.
  test("빠르게·느리게 입력하고 지워도 화면이 밀리지 않는다", async ({ page }) => {
    await page.goto("/tools/material-quote");
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
    await page.evaluate(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        // Late shifts only: a shift within 500ms of a keystroke is the typing itself.
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push(e.value);
      }).observe({ type: "layout-shift" });
    });
    const box = page.getByRole("combobox", { name: "재료 이름" });
    await box.pressSequentially("재련", { delay: 30 });
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.waitForTimeout(600);
    await box.pressSequentially(" 재료", { delay: 400 });
    await page.waitForTimeout(600);
    for (let i = 0; i < 5; i++) await box.press("Backspace", { delay: 250 });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.__shifts)).toEqual([]);
    // 아래 내용 위로 떠 있고, 초점이 상자 밖으로 나가면 닫힌다.
    await box.pressSequentially("재련", { delay: 30 });
    await expect(page.getByRole("listbox", { name: "검색 결과" })).toBeVisible();
    await page.getByRole("tablist", { name: "카테고리" }).getByRole("tab").first().focus();
    await expect(page.getByRole("listbox", { name: "검색 결과" })).toHaveCount(0);
    await expect(box).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("시세 1분 자동 갱신 @smoke", () => {
  // 사용자 10-16: 시세가 들어가는 화면은 1분마다 시세를 새로 받는다(보이는 탭에서만, 입력값은 그대로).
  // 브라우저 시계를 앞으로 돌려 1분 뒤 요청이 한 번 더 가는지, 화면이 그대로인지 본다.
  test("재련 계획: 1분 뒤 재료 시세를 다시 받고 '시세 HH:mm 기준'을 보인다", async ({ page }) => {
    await page.clock.install();
    let calls = 0;
    page.on("request", (r) => r.url().includes("/api/markets/material-prices") && calls++);
    await page.goto("/tools/refining");
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    await expect(page.getByText(/^시세 \d{2}:\d{2} 기준 · 1분마다 새로 불러와요$/)).toBeVisible();
    const first = calls;
    expect(first).toBeGreaterThan(0);
    await page.clock.runFor(61_000);
    await expect.poll(() => calls).toBe(first + 1);
    await expect(page.getByRole("region", { name: "예상 소모" }).getByText(/총 12단계/)).toBeVisible();
  });

  // api #600: 시세 없는 줄의 이유가 한도(RATE_LIMITED·SEARCH_LIMIT)면 '잠시 뒤 다시', 그 밖은 '가격 없음'.
  for (const [reason, text] of [
    ["RATE_LIMITED", "지금은 못 불러왔어요 · 잠시 뒤 다시 불러와요"],
    ["SEARCH_LIMIT", "지금은 못 불러왔어요 · 잠시 뒤 다시 불러와요"],
    ["OFFICIAL_UNAVAILABLE", "선택한 기준의 가격이 없어요"],
    [null, "선택한 기준의 가격이 없어요"],
  ])
    test(`재련 계획: 시세 없는 재료 줄은 이유(${reason ?? "없음"})에 맞게 안내한다`, async ({ page }) => {
      await page.route("**/api/markets/material-prices", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const envelope = body.envelope ?? body;
        // The plan's first material has no price now, for this reason (whatever the plan holds).
        Object.assign(envelope.data.items[0], {
          status: "PRICE_UNAVAILABLE",
          unitPriceGold: null,
          bundleCount: null,
          bundlePrice: null,
          contentsPerItem: null,
          unavailableReason: reason,
        });
        await route.fulfill({ response, json: body });
      });
      // This describe opens no page of its own: go to the plan after the route is set.
      await page.goto("/tools/refining");
      await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
      // Structural, not by role: on a phone the table is laid out as cards.
      await expect(page.locator("th[scope=row]").filter({ hasText: text })).toHaveCount(1);
    });

  test("재료 견적: 계산한 뒤 1분마다 같은 입력으로 다시 계산하고, 화면은 제자리다", async ({ page }) => {
    await page.clock.install();
    let calls = 0;
    page.on("request", (r) => r.url().includes("/api/markets/material-quotes") && calls++);
    await page.goto("/tools/material-quote");
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
    // #855: the name box is a combobox and each result row is an option.
    await page.getByRole("combobox", { name: "재료 이름" }).fill("합성");
    await page.getByRole("option", { name: "합성 재련 재료 견적에 추가" }).click();
    await page.getByRole("textbox", { name: "필요", exact: true }).fill("250");
    await page.getByRole("button", { name: "견적 계산" }).click();
    await expect(page.getByText(/1분마다 시세를 새로 받아 다시 계산해요/)).toBeVisible();
    expect(calls).toBe(1);
    // Position in the document (the scroll to the result may still be running).
    const docY = () => page.locator("#quote-total").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    // Let the result finish its entrance (the clock is paused) before measuring.
    await page.clock.runFor(2_000);
    await page.waitForTimeout(800);
    const y = await docY();
    await page.clock.runFor(59_000);
    await expect.poll(() => calls).toBe(2);
    // The button keeps its label (the refresh is not "계산 중") and the result stays put.
    await expect(page.getByRole("button", { name: "견적 계산" })).toBeVisible();
    expect(await docY()).toBeCloseTo(y, 0);
  });
});

test.describe("치적·뭉가·음돌 @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/crit-speed");
  });

  test("캐릭터를 계산하면 치명타·속도 출처를 보여 준다", async ({ page }) => {
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("상세");
    await page.getByRole("button", { name: "계산하기" }).click();
    await expect(page.getByText(/규칙 crit-speed-v\d+/)).toBeVisible();
    await expect(page.getByText("백어택 적중 가정")).toBeVisible();
    // The parts and their sum, written out (PM-프론트 P2, crit-speed v7).
    await expect(page.getByText(/캐릭터 [\d.]+% \+ 가정 [\d.]+% = 합계 [\d.]+%/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  // api #711: a stat that could not be read gives its reason, shown in place of
  // the numbers built on it (they would lack the stat); the other axis stays.
  test("읽지 못한 스탯은 이유를 보이고 그 축의 숫자는 숨긴다", async ({ page }) => {
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("치명못읽음");
    await page.getByRole("button", { name: "계산하기" }).click();
    const crit = page.getByRole("region", { name: "치명타 적중률" });
    await expect(crit).toContainText("치명 스탯을 읽지 못해 치명타 적중률을 계산하지 않았어요.");
    await expect(crit.getByText(/= 합계/)).toHaveCount(0);
    await expect(crit.getByText("뭉툭한 가시")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "공격·이동 속도" }).getByText("음속 돌파")).toBeVisible();

    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("신속못읽음");
    await page.getByRole("button", { name: "계산하기" }).click();
    const speed = page.getByRole("region", { name: "공격·이동 속도" });
    await expect(speed).toContainText("신속 스탯을 읽지 못해 공격·이동 속도를 계산하지 않았어요.");
    await expect(speed.getByText("음속 돌파")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "치명타 적중률" }).getByText(/= 합계/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("없는 캐릭터는 안내한다", async ({ page }) => {
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("미존재");
    await page.getByRole("button", { name: "계산하기" }).click();
    await expect(page.getByText("캐릭터를 찾지 못했어요")).toBeVisible();
  });
});

// 도구 목록(/tools)과 옛 돌파고 주소의 영구 이동(방향 전환 2026-10-10 §6).
test.describe("도구 목록 @smoke", () => {
  test("도구 카드로 각 화면에 간다", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByRole("heading", { level: 1, name: "도구 모음" })).toBeVisible();
    await expect(page.getByRole("link", { name: /재련 기대 비용/ })).toHaveAttribute("href", "/tools/refining");
    await expect(page.getByRole("link", { name: /돌파고/ })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("옛 돌파고 주소는 도구 목록으로 영구 이동한다", async ({ page }) => {
    const response = await page.request.get("/tools/stone?m=1s", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(/\/tools$/);
  });
});
