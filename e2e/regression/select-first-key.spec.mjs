// 회귀(QA 2026-11-13 10시 P2): 한 번도 쓰지 않은 공통 Select에 키보드 포커스가 가면, 가벼운 단추가
// 전체 Select로 바뀌는 동안 포커스가 <body>로 빠졌다. 그래서 첫 Enter·Space·ArrowDown이 사라지고,
// 바로 Tab을 다시 누르면 같은 칸에 다시 머물렀다. 전체 Select 코드가 늦게 와도(느린 연결) 포커스는
// 칸에 남고, 그 사이 누른 키로 목록이 열리며, 다음 Tab은 다음 칸으로 간다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Holds every script chunk asked for from now on (the full Select's code), as on a slow connection. */
const slowChunks = (page, ms = 800) =>
  page.route(/\/_next\/static\/chunks\/.*\.js(\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });

const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el === document.body || !el ? "BODY" : `${el.getAttribute("role") ?? el.tagName}:${el.getAttribute("aria-label") ?? el.id}`;
  });

for (const key of ["ArrowDown", "Enter", " "]) {
  test(`처음 쓰는 Select: 포커스 직후 '${key === " " ? "Space" : key}'로 목록이 열린다(코드가 늦게 와도) @regression`, async ({ page }) => {
    await gotoReady(page, "/tools/hell-reward");
    const field = page.getByRole("combobox", { name: "클리어 단계" });
    await expect(field).toBeVisible();
    await slowChunks(page);
    await field.focus();
    await page.keyboard.press(key);
    // While the code is on its way the field keeps focus.
    expect(await focused(page)).not.toBe("BODY");
    await expect(page.getByRole("listbox")).toBeVisible();
    // The list works from the keyboard: Escape closes it and focus is back on the field.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "클리어 단계" })).toBeFocused();
  });
}

test("처음 쓰는 Select: 포커스 직후 Tab은 다음 칸으로 간다(같은 칸에 다시 머물지 않음) @regression", async ({ page }) => {
  await gotoReady(page, "/tools/hell-reward");
  const field = page.getByRole("combobox", { name: "클리어 단계" });
  await expect(field).toBeVisible();
  await slowChunks(page);
  await field.focus();
  const before = await focused(page);
  await page.keyboard.press("Tab");
  const after = await focused(page);
  expect(after, `Tab 뒤 포커스 ${after}`).not.toBe("BODY");
  expect(after, "Tab 뒤에도 같은 칸").not.toBe(before);
  // Once the code is here the field it left is the full Select, still in its place and unopened.
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "클리어 단계" })).toBeVisible();
});
