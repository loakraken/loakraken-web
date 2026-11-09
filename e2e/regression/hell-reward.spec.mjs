// 빈틈 #3 지옥 · 나락 보상: 열쇠 단계별 고정 보상을 시세(목 서버의 합성 값)와 직접 정한 값으로 매긴다.
// 목 시세: 빙하의 숨결 430G, 용암의 숨결 없음, 결정 9G · 수호석 결정 1.9G · 위대한 돌파석 33G · 상급 융화 271G, 전이 돌파석 · 운명/혼돈의 돌 없음.
import { test, expect, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360, 320])
  test(`${width} 지옥 · 나락 보상: 시세 · 직접 정한 값 · 둘 중 하나, 단계표, 흔들림 0 @regression @smoke`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto("/tools/hell-reward");
    await expect(page.getByRole("heading", { level: 1, name: "지옥 · 나락 보상" })).toBeVisible();
    const sums = page.locator("dl").filter({ hasText: "시세로 매긴 것" });
    const total = sums.getByRole("definition").first();
    const lines = page.getByRole("list", { name: "보상 품목" });
    const line = (name) => lines.getByRole("listitem").filter({ hasText: name });

    // 지옥 1750 · 0단계 기본: 파괴석 결정 600 × 9 (수호석 결정 1,800 × 1.9보다 큼) + 위대한 30 × 33 + 상급 융화 75 × 271
    // + 빙하 36 × 430 + 귀속 골드 5,500 = 47,695 (용암 · 전이 돌파석 · 운명/혼돈의 돌은 목 시세가 없어 0G).
    await expect(total).toHaveText("47,695G");
    await expect(line("용암의 숨결")).toContainText("시세 없음");
    await expect(line("운명의 파괴석 결정")).toContainText("거래 가능 여부 확인 전");
    await expect(line("팔찌 상자 (고대)")).toContainText("시세 없음 · 직접 정한 값");
    await page.waitForTimeout(600);
    const first = await shiftsSince(page);
    expect(first.all, `시세 도착 흔들림 (${first.moved})`).toBe(0);

    // 직접 정한 값: 고대 팔찌 상자 1개 100G → 4 × 100.
    await page.getByRole("spinbutton", { name: "팔찌 상자 (고대) 1개 값(골드)" }).fill("100");
    await expect(total).toHaveText("48,095G");
    // 시세가 없는 시세 품목도 직접 값으로(계산 검증 #1525 P1): 용암 1개 10G → 12 × 10.
    await expect(line("용암의 숨결")).toContainText("시세 없음 · 1개 값");
    await page.getByRole("spinbutton", { name: "용암의 숨결 1개 값(골드)" }).fill("10");
    await expect(total).toHaveText("48,215G");

    // 나락: 품목 이름이 아직 정해지지 않아 운명/혼돈의 돌은 직접 값, 둘 중 큰 쪽만 셈.
    await page.getByRole("radiogroup", { name: "종류" }).getByRole("radio", { name: "나락" }).click();
    // 빙하 180 × 430 + 용암 60 × 10 + 귀속 골드 27,500 + 고대 팔찌 20 × 100.
    await expect(total).toHaveText("107,500G");
    await expect(line("운명의 돌")).toContainText("품목 확인 중 · 직접 정한 값");
    await page.getByRole("spinbutton", { name: "운명의 돌 1개 값(골드)" }).fill("2");
    await expect(total).toHaveText("107,590G");
    await expect(line("혼돈의 돌")).toContainText("셈 안 함");
    await expect(line("운명의 돌")).toContainText("둘 중 하나만 셈");
    await expect(line("운명의 돌")).toContainText("90G");

    // 지옥 1730: 재료 넷은 게임 안 기록에 (귀속) → '귀속, 시세로 환산'.
    await page.getByRole("radiogroup", { name: "종류" }).getByRole("radio", { name: "지옥" }).click();
    await page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: "1730" }).click();
    await expect(line("운명의 파괴석 결정")).toContainText("귀속, 시세로 환산");
    await expect(line("전이 돌파석")).toContainText("시세 없음");
    // 4,500 + 위대한 25 × 33 + 상급 60 × 271 + 빙하 30 × 430 + 용암 10 × 10 + 귀속 골드 4,500 + 고대 팔찌 3 × 100
    // + 운명의 돌 7 × 2(시세 없음, 나락에서 넣은 값).
    await expect(total).toHaveText("39,399G");
    // 고른 종류 · 열쇠 단계는 주소에 남아 다시 열어도 그대로(#889).
    await expect(page).toHaveURL(/level=1730/);
    await page.reload();
    await expect(page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: "1730" })).toBeChecked();
    // 단계표 11줄, 고른 단계가 표시된다.
    await chooseOption(page, page.getByRole("combobox", { name: "클리어 단계" }), "10단계");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(12);
    await expect(table.locator("tr[aria-current]")).toContainText("10단계");
    await expectNoHorizontalOverflow(page);
  });
