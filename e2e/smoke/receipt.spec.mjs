import { readFileSync } from "node:fs";
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

// Roster receipt total follows the backend's total.status (#665): a partial
// sum says so, and "nothing counted" shows no amount at all. The mock's own
// first/second-call switch is shared by every test project, so each test pins
// the status it checks by answering the receipt request with the backend
// sample, changed for that case.
const receiptPath = (name) => `${characterPath(name, "siblings")}&view=receipt`;
const SAMPLE = new URL("../../tests/receipt-fixtures/character-receipt.json", import.meta.url);

async function pin(page, change) {
  await page.route(/\/api\/characters\/receipt\?/, async (route) => {
    const body = JSON.parse(readFileSync(SAMPLE, "utf8"));
    body.data.characterName = new URL(route.request().url()).searchParams.get("characterName");
    body.data.computedAt = new Date().toISOString();
    change(body.data);
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

  test("백엔드가 영수증을 꺼 두면 빈 칸 대신 '아직 열리지 않았어요'를 보인다", async ({ page }) => {
    await page.goto(receiptPath("영수증꺼짐"));
    const panel = page.getByRole("region", { name: "원정대 영수증" });
    await expect(panel.getByRole("status")).toHaveText("원정대 영수증은 아직 열리지 않았어요.");
    await expect(panel.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
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
