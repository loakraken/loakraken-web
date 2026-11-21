// 연마 한꺼번에(PM 총괄 11-21 18:28, 흡수 X1): 시뮬레이터 연마 칸에서 모든 줄을 한 번에 상 · 중 · 하로(각 줄은 제 옵션
// 그대로, 공식 수치), 또는 모두 '점수 옵션 없는 줄'로. 한 번 누름 = 이전 한 번. 모든 줄이 그 상태면 그 버튼이 눌린 상태.
// 320 · 1280 가로 넘침 없음. 목 '전투력계산': 목걸이 두 줄(추가 피해 중, 적에게 주는 피해 하).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const PATH = `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`;
const polish = (page) => page.getByRole("region", { name: "연마", exact: true });
const presets = (page) => polish(page).getByRole("group", { name: "연마 모든 줄 한꺼번에" });
const grades = (page) => [
  page.getByRole("combobox", { name: "테스트 목걸이 추가 피해 등급" }),
  page.getByRole("combobox", { name: "테스트 목걸이 적에게 주는 피해 등급" }),
];
/** The POLISH changes of the next simulate request the page sends. */
const nextPolish = (page) =>
  page
    .waitForRequest((r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST")
    .then((r) => r.postDataJSON().changes.filter((c) => c.kind === "POLISH").map((c) => [c.option, c.grade ?? null]));

for (const width of [320, 1280])
  test(`@A37 ${width} 연마 모든 줄을 한꺼번에 상 · 중 · 하 · 없음으로, 이전 한 번에 되돌린다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, PATH);
    const group = presets(page);
    const button = (name) => group.getByRole("button", { name, exact: true });
    await expect(group.getByRole("button")).toHaveText(["모두 상", "모두 중", "모두 하", "모두 없음"]);
    // Worn: 중 and 하, so no preset is pressed.
    for (const name of ["모두 상", "모두 중", "모두 하", "모두 없음"]) await expect(button(name)).toHaveAttribute("aria-pressed", "false");

    // 모두 상: each line keeps its own option, at 상, with the official value.
    let sent = nextPolish(page);
    await button("모두 상").click();
    for (const grade of grades(page)) await expect(grade).toContainText(/^상\(/);
    expect((await sent).map(([, grade]) => grade)).toEqual(["HIGH", "HIGH"]);
    await expect(button("모두 상")).toHaveAttribute("aria-pressed", "true");
    await expect(button("모두 중")).toHaveAttribute("aria-pressed", "false");

    // 모두 하: the worn 하 line is no change any more, the other one is.
    sent = nextPolish(page);
    await button("모두 하").click();
    for (const grade of grades(page)) await expect(grade).toContainText(/^하\(/);
    expect((await sent).map(([, grade]) => grade)).toEqual(["LOW"]);
    await expect(button("모두 하")).toHaveAttribute("aria-pressed", "true");

    // 모두 없음: every line a line with no scoring option, no grade to pick.
    sent = nextPolish(page);
    await button("모두 없음").click();
    await expect(polish(page).getByText("점수 옵션 없는 줄")).toHaveCount(2);
    await expect(polish(page).getByText("등급 없음")).toHaveCount(2);
    expect(await sent).toEqual([["NONE", null], ["NONE", null]]);
    await expect(button("모두 없음")).toHaveAttribute("aria-pressed", "true");
    await expectNoHorizontalOverflow(page);

    // 모두 상 after 없음: the lines go back to their own options, at 상.
    await button("모두 상").click();
    for (const grade of grades(page)) await expect(grade).toContainText(/^상\(/);
    await expect(polish(page).getByText("점수 옵션 없는 줄")).toHaveCount(0);

    // One press is one 이전: back to 모두 없음, then to 모두 하.
    await page.getByRole("button", { name: "이전", exact: true }).click();
    await expect(polish(page).getByText("점수 옵션 없는 줄")).toHaveCount(2);
    await page.getByRole("button", { name: "이전", exact: true }).click();
    for (const grade of grades(page)) await expect(grade).toContainText(/^하\(/);
    await expectNoHorizontalOverflow(page);
  });
