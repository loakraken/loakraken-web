import { readFileSync } from "node:fs";
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

// Roster receipt total follows the backend's total.status (#665): a partial
// sum says so, and "nothing counted" shows no amount at all. The mock's own
// first/second-call switch is shared by every test project, so each test pins
// the status it checks by answering the receipt request with the backend
// sample, changed for that case.
const receiptPath = (name) => `${characterPath(name, "siblings")}&view=receipt`;
const SAMPLE = new URL("../../tests/receipt-fixtures/character-receipt.json", import.meta.url);

async function pin(page, change) {
  let call = 0;
  await page.route(/\/api\/characters\/receipt\?/, async (route) => {
    call += 1;
    const body = JSON.parse(readFileSync(SAMPLE, "utf8"));
    body.data.characterName = new URL(route.request().url()).searchParams.get("characterName");
    body.data.computedAt = new Date().toISOString();
    // The call number lets a test answer a later request differently.
    change(body.data, call);
    // The app's own route answers { ok, envelope } (lib/api/respond.ts).
    await route.fulfill({ json: { ok: true, envelope: body } });
  });
}

const total = (page) => page.locator("[data-status]").first();

test.describe("원정대 영수증 합계 @smoke", () => {
  test("일부만 센 합계는 금액 옆에 '일부 합계'를 붙이고, 빠진 것을 바로 아래에 모아 보인다", async ({ page }) => {
    await pin(page, (data) => {
      data.total.status = "PARTIAL";
      data.coverage = { ...data.coverage, ready: 8, pending: 2 };
    });
    await page.goto(receiptPath("영수증본캐"));
    await expect(total(page)).toHaveAttribute("data-status", "PARTIAL");
    await expect(total(page).getByText("일부 합계")).toBeVisible();
    await expect(total(page)).toContainText(/[\d,]+G/);
    await expect(total(page)).toContainText("계산한 것만 더했어요");
    await expect(total(page)).toContainText("빠진 것: 계산 대기 2명 · 완갑 제외");
    // Rows left out by rule carry a small count.
    await expect(page.getByText("산정 제외 2건").first()).toBeAttached();
    await expect(page.locator("details summary").filter({ hasText: "제외 2" }).first()).toBeVisible();
  });

  test("모두 센 합계는 금액만, '일부 합계' 표시는 없다", async ({ page }) => {
    await pin(page, (data) => {
      data.total.status = "COMPLETE";
      data.coverage = { ...data.coverage, ready: data.coverage.rosterCharacters, pending: 0, nextAvailableAt: null };
      for (const c of data.equipment.characters)
        if (c.status === "PENDING") Object.assign(c, { status: "READY", gold: 1000, complete: true });
    });
    await page.goto(receiptPath("영수증본캐"));
    await expect(total(page)).toHaveAttribute("data-status", "COMPLETE");
    await expect(total(page)).toContainText("장비 재련 · 보석 합계");
    await expect(total(page).getByText("일부 합계")).toHaveCount(0);
  });

  test("센 금액이 없으면 0G 대신 '합계 없음'과 빠진 이유를 보이고, 일부만 센 캐릭터에 표시가 붙는다", async ({ page }) => {
    await page.goto(receiptPath("영수증시세없음"));
    await expect(total(page)).toHaveAttribute("data-status", "UNAVAILABLE");
    await expect(total(page).getByText("합계 없음")).toBeVisible();
    await expect(total(page)).not.toContainText(/\dG/);
    await expect(total(page)).toContainText("시세 없음");
    await expect(page.getByText("일부만 계산").first()).toBeAttached();
    await expect(page.locator("details summary").filter({ hasText: /일부\s*일부만 계산/ }).first()).toBeVisible();
  });

  test("대기 중인 캐릭터는 패널이 스스로 채우고, 그동안은 '갱신 중'이며 다시 계산 단추가 없다", async ({ page }) => {
    // First answer: 2 members still pending, the backend says ask again now (cap stop).
    // Second answer: everyone in.
    await pin(page, (data, call) => {
      if (call === 1) {
        data.total.status = "PARTIAL";
        data.coverage = { ...data.coverage, ready: 8, pending: 2, nextAvailableAt: new Date().toISOString() };
      } else {
        data.total.status = "COMPLETE";
        data.coverage = { ...data.coverage, ready: 10, pending: 0, nextAvailableAt: null };
        for (const c of data.equipment.characters)
          if (c.status === "PENDING") Object.assign(c, { status: "READY", gold: 1000, complete: true });
      }
    });
    await watchShifts(page);
    await page.goto(receiptPath("영수증본캐"));
    await expect(page.getByText("원정대 10명 중 8명 계산 · 2명 갱신 중")).toBeVisible();
    await expect(page.getByRole("button", { name: /다시 계산/ })).toHaveCount(0);
    const mark = await shiftMark(page);
    // At least 3 s later, filled in without a press, and nothing on the page moved (A7).
    await expect(total(page)).toHaveAttribute("data-status", "COMPLETE", { timeout: 15_000 });
    await expect(page.getByText("원정대 10명 중 10명 계산")).toBeVisible();
    await page.waitForTimeout(500);
    expect((await shiftsSince(page, mark)).all, "채워지는 동안 흔들림").toBe(0);
  });

  test("채워지지 않으면 두 번 뒤 스스로 멈추고 '다시 계산(2명씩)'을 보인다; 찾지 못한 캐릭터는 '확인 못 함'", async ({ page }) => {
    await pin(page, (data) => {
      data.total.status = "PARTIAL";
      data.equipment.characters[9].status = "UNAVAILABLE";
      data.coverage = { ...data.coverage, ready: 8, pending: 1, unavailable: 1, nextAvailableAt: new Date().toISOString() };
    });
    let requests = 0;
    page.on("request", (r) => r.url().includes("/api/characters/receipt?") && requests++);
    await page.goto(receiptPath("영수증본캐"));
    await expect(page.getByText("1명 확인 못 함").first()).toBeVisible();
    await expect(page.locator("details summary").filter({ hasText: "확인 못 함" }).first()).toBeVisible();
    // Pending never drops: it stops by itself and hands over to the button.
    await expect(page.getByRole("button", { name: "다시 계산(2명씩)" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("원정대 10명 중 8명 계산 · 1명 대기 · 1명 확인 못 함")).toBeVisible();
    const after = requests;
    await page.waitForTimeout(4_000);
    expect(requests, "멈춘 뒤에는 스스로 다시 묻지 않는다").toBe(after);
  });

  for (const width of [320, 360, 390]) {
    test(`${width}px: 합계·표시가 잘리지 않고 옆으로 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await pin(page, (data) => {
        data.total.status = "PARTIAL";
        data.equipment.characters[0].complete = false;
      });
      await page.goto(receiptPath("영수증본캐"));
      await expect(total(page).getByText("일부 합계")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      // Tags and the amount sit fully inside the panel (no ellipsis cut, A37).
      const cut = await page.evaluate(() =>
        [...document.querySelectorAll("[data-status] strong, [data-status] span, details summary b, details summary span")]
          // Screen-reader-only text is clipped to 1px on purpose.
          .filter((el) => !el.classList.contains("sr-only"))
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible")
          .map((el) => el.textContent),
      );
      expect(cut).toEqual([]);
    });
  }
});
