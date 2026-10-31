// 회귀(사용자 10-31, api #697): 캐릭터 '통계' 탭의 칭호 기록 — 요약 3칸(칭호 수 · 가장 희귀 + 비율 · 첫 기록),
// 칭호 한 표(칭호 · 장착 기록 비율 · 첫 기록)를 장착 기록 비율이 낮은(희귀한) 순으로. 표본이 모자란 칭호는 비율 대신
// '표본 N명 — 모으는 중'으로 맨 아래. 비율은 장착 기록 기준이라 실제 보유율보다 낮을 수 있다는 안내, 획득 조건 칸은 없음.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 1280])
  test(`${width}: 칭호 기록 — 요약 3칸, 희귀한 순, 모으는 중은 맨 아래 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세", "stats"));
    const panel = page.getByRole("region", { name: "칭호 기록", exact: true });
    await expect(panel.getByRole("table")).toBeVisible();
    await expect(panel).toContainText("실제 보유율보다 낮을 수 있어요");
    // Columns: no 획득 조건.
    await expect(panel.getByRole("columnheader")).toHaveText(["칭호", "장착 기록 비율", "첫 기록"]);
    // Rarest first among the ready ones; the not-ready one and the unrated ones last.
    const names = await panel.getByRole("rowheader").allTextContents();
    expect(names.slice(0, 2), names.join(",")).toEqual(["에키드나를 쓰러뜨린 자", "빛을 꺼트리는 자"]);
    const collecting = panel.getByRole("row", { name: /별을 제패한 자/ });
    await expect(collecting).toContainText(/표본 \d+명 — 모으는 중/);
    expect(names.indexOf("별을 제패한 자"), "모으는 중은 비율 있는 칭호 뒤").toBeGreaterThan(1);
    // Summary: count, the rarest with its rate, the first record date.
    const summary = panel.locator("dl");
    await expect(summary).toContainText(`${names.length}개`);
    await expect(summary).toContainText(/에키드나를 쓰러뜨린 자 [\d.]+%/);
    await expect(summary).toContainText(/\d{4}-\d{2}-\d{2}/);
    // Loaded last on the tab: nothing above moved.
    await page.waitForTimeout(600);
    const { quiet, moved } = await shiftsSince(page);
    expect(quiet, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
