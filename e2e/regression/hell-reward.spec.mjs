// 빈틈 #3 지옥 · 나락 보상: 열쇠 하나로 보이는 상자 가운데 하나를 연다(PM 총괄 11-10). 상자마다 그 안의 보상
// (+ 기본 보상)을 시세(목 서버의 합성 값)와 직접 정한 값으로 매겨 좋은 순으로 보이고, 맨 위가 '가장 좋은 상자'.
// 목 시세: 빙하의 숨결 430G, 용암의 숨결 없음, 결정 9G · 수호석 결정 1.9G · 위대한 돌파석 33G · 상급 융화 271G,
// 전이 돌파석 · 운명/혼돈의 돌 없음.
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

    // 지옥 1750 · 0단계: 상자마다 따로. 융화 75 × 271 = 20,325 > 재련 보조(빙하 36 × 430 = 15,480, 용암 시세 없음)
    // > 귀속 골드 5,500 > 파괴석 결정 600 × 9 = 5,400. 모든 상자의 합(47,695)이 아니다.
    await expect(bestName).toHaveText("융화 재료 상자");
    await expect(bestValue).toHaveText("20,325G");
    await expect(list.locator(":scope > li").first()).toContainText("융화 재료 상자");
    await expect(box("재련 보조 상자")).toContainText("15,480G");
    await expect(box("귀속 골드 상자")).toContainText("5,500G");
    // 기본 보상은 수량 확인 전이라 넣지 않고, 그렇다고 보인다. 풍요는 기본 보상이 있어야 켤 수 있다.
    await expect(head.getByRole("definition").nth(2)).toHaveText("확인 중");
    await expect(page.getByText("기본 보상은 수량 확인 중이라 상자 값에 아직 넣지 않았어요.")).toBeVisible();
    await expect(page.getByRole("switch", { name: "풍요(기본 보상 ×10)" })).toBeDisabled();
    // 0G로 센 직접 값 품목: 용암 · 전이 돌파석 · 운명/혼돈의 돌 중 센 하나 · 스톤 키트 · 팔찌 · 젬.
    await expect(page.getByText("직접 값 없이 0G로 센 품목 6개")).toBeVisible();
    await expect(line("운명의 파괴석 결정")).toContainText("거래 가능 여부 확인 전");
    await page.waitForTimeout(600);
    const first = await shiftsSince(page);
    expect(first.all, `시세 도착 흔들림 (${first.moved})`).toBe(0);

    // 직접 정한 값은 그 품목의 상자에만: 고대 팔찌 1개 100G → 팔찌 상자 400, 용암 1개 10G → 재련 보조 15,600.
    await page.getByRole("spinbutton", { name: "팔찌 상자 (고대) 1개 값(골드)" }).fill("100");
    await expect(box("팔찌 상자")).toContainText("400G");
    await page.getByRole("spinbutton", { name: "용암의 숨결 1개 값(골드)" }).fill("10");
    await expect(box("재련 보조 상자")).toContainText("15,600G");
    await expect(bestValue).toHaveText("20,325G");
    await expect(page.getByText("직접 값 없이 0G로 센 품목 4개")).toBeVisible();

    // 나락 1750 · 0단계: 재련 보조(용암 60 × 10 + 빙하 180 × 430 = 78,000)가 가장 좋다.
    await page.getByRole("radiogroup", { name: "종류" }).getByRole("radio", { name: "나락" }).click();
    await expect(bestName).toHaveText("재련 보조 상자");
    await expect(bestValue).toHaveText("78,000G");
    await expect(box("귀속 골드 상자")).toContainText("27,500G");
    // 운명/혼돈의 돌 상자는 둘 중 하나: 운명의 돌 45 × 2 = 90.
    await page.getByRole("spinbutton", { name: "운명의 돌 1개 값(골드)" }).fill("2");
    await expect(box("운명 · 혼돈의 돌 상자")).toContainText("90G");
    await expect(line("혼돈의 돌")).toContainText("셈 안 함");

    // 지옥 1730: 재료 넷은 게임 안 기록에 (귀속) → '귀속, 시세로 환산'. 융화 60 × 271 = 16,260이 가장 좋다.
    await page.getByRole("radiogroup", { name: "종류" }).getByRole("radio", { name: "지옥" }).click();
    await page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: "1730" }).click();
    await expect(line("운명의 파괴석 결정")).toContainText("귀속, 시세로 환산");
    await expect(bestName).toHaveText("융화 재료 상자");
    await expect(bestValue).toHaveText("16,260G");
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
