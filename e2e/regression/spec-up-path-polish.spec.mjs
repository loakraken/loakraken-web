// 회귀(api #951, 백엔드 11-15): 추천 순서의 연마 단계는 장신구를 바꾸는 단계라 줄마다 옵션과 등급이 바뀌고, 점수 옵션이
// 없는 줄은 option "NONE"(등급 없음)으로 온다. '이 순서를 시뮬레이터에서 열기'는 그 단계를 통째로 넘겨(빼면 단계 전투력과
// 다른 값), 계산 요청에 NONE 줄을 등급 없이 그대로 보내고, 화면 어디에도 "NONE"이라는 코드 대신 말로 보여 준다.
// 목: "스펙순서연마"는 보석 두 단계 뒤에 테스트 목걸이 연마 단계(1줄 적에게 주는 피해 % 상, 2줄 NONE)가 붙는다.
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const NAME = "스펙순서연마";

for (const width of [320, 1280])
  test(`${width}: 연마 단계를 통째로 시뮬레이터에서 열고, 점수 옵션 없는 줄은 말로 보인다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(characterPath(NAME, "specup"));
    const open = page.getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" });
    await expect(open).toBeVisible();
    // Every step goes in: nothing is left out for the simulator.
    await expect(page.getByText(/단계는 시뮬레이터에서 아직 바꿀 수 없어/)).toHaveCount(0);
    const asked = page.waitForRequest((r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST");
    await open.click();
    const polish = (await asked).postDataJSON().changes.filter((c) => c.kind === "POLISH");
    expect(polish.map(({ line, option, grade }) => ({ line, option, grade }))).toEqual([
      { line: 0, option: "적에게 주는 피해 %", grade: "HIGH" },
      { line: 1, option: "NONE", grade: undefined },
    ]);
    // exact: the character banner ("스펙순서연마 캐릭터 요약") has the word too.
    const card = page.getByRole("region", { name: "연마", exact: true });
    // The new option by name (no " %" mark) with its table value, the worn line under it.
    await expect(card.getByRole("combobox", { name: "테스트 목걸이 적에게 주는 피해 등급" })).toHaveText("상(+2.00%)");
    await expect(card).toContainText("테스트 목걸이 · 지금 추가 피해 +1.60%");
    // The line with no scoring option: in words, with no grade to pick.
    await expect(card).toContainText("점수 옵션 없는 줄");
    await expect(card).toContainText("등급 없음");
    await expect(card.getByRole("combobox")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "바꾼 것" })).toContainText("점수 옵션 없는 줄");
    await expect(page.locator("main")).not.toContainText("NONE");
    await expectNoHorizontalOverflow(page);
  });
