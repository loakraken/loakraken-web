// 회귀(QA 2026-11-13 10시 P2): 한 번도 쓰지 않은 공통 Select에 키보드 포커스가 가면, 가벼운 단추가
// 전체 Select로 바뀌는 동안 포커스가 <body>로 빠졌다. 그래서 첫 Enter·Space·ArrowDown이 사라지고,
// 바로 Tab을 다시 누르면 같은 칸에 다시 머물렀다. 전체 Select 코드가 늦게 와도(느린 연결) 포커스는
// 칸에 남고, 그 사이 누른 키로 목록이 열리며, 다음 Tab은 다음 칸으로 간다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/**
 * Holds every script chunk asked for from now on (the full Select's code), as on a slow connection.
 * `arrived()` waits until at least one was held and all are released, plus a moment to run them:
 * the point after which the full Select can exist. (waitForLoadState("networkidle") does not wait
 * here: the page reached that state before, so it returns at once.)
 */
async function slowChunks(page, ms = 800) {
  const held = { seen: 0, open: 0 };
  await page.route(/\/_next\/static\/chunks\/.*\.js(\?|$)/, async (route) => {
    held.seen += 1;
    held.open += 1;
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
    held.open -= 1;
  });
  return {
    arrived: async () => {
      await expect.poll(() => held.seen > 0 && held.open === 0, { timeout: 10_000 }).toBe(true);
      await page.waitForTimeout(400);
    },
  };
}

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
  const chunks = await slowChunks(page);
  await field.focus();
  // A second Tab 80–250 ms after the first (QA's window): after the swap began, before the code came.
  await page.waitForTimeout(150);
  await page.keyboard.press("Tab");
  // Judged once the held code has arrived (codex #1576 P3), not at a fixed time: nothing may pull focus back.
  await chunks.arrived();
  const after = await focused(page);
  expect(after, `Tab 뒤 포커스 ${after}`).not.toBe("BODY");
  // The field itself (by role and name, whichever button draws it) must not hold focus again.
  await expect(field, "Tab 뒤에도 같은 칸").not.toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "클리어 단계" })).toBeVisible();
});

// codex #1576 P2: a key pressed while the code loads asks for the list, but the user may change their mind
// before it arrives. The list must not open, nor focus come back, on a field the user left or closed.
for (const [name, leave] of [
  ["Esc", async (page) => page.keyboard.press("Escape")],
  ["Tab", async (page) => page.keyboard.press("Tab")],
  ["다른 곳 누르기", async (page) => page.getByRole("heading", { level: 1 }).click()],
]) {
  test(`처음 쓰는 Select: 코드를 기다리는 중 아래 화살표 뒤 ${name} → 코드가 와도 목록이 열리지 않는다 @regression`, async ({ page }) => {
    await gotoReady(page, "/tools/hell-reward");
    const field = page.getByRole("combobox", { name: "클리어 단계" });
    await expect(field).toBeVisible();
    const chunks = await slowChunks(page);
    // Any list that appears at any moment counts: a list that opens on a field the user left and then
    // closes again (focus is elsewhere) is still a flash the user sees.
    await page.evaluate(() => {
      window.__listboxSeen = false;
      new MutationObserver(() => {
        if (document.querySelector("[role=listbox]")) window.__listboxSeen = true;
      }).observe(document.body, { childList: true, subtree: true, attributes: true });
    });
    await field.focus();
    await page.keyboard.press("ArrowDown");
    await leave(page);
    await chunks.arrived();
    expect(await page.evaluate(() => window.__listboxSeen), "코드가 온 뒤 목록이 열렸음").toBe(false);
    await expect(page.getByRole("listbox")).toHaveCount(0);
    if (name === "Esc") await expect(field, "Esc 뒤 포커스는 칸에").toBeFocused();
    else await expect(field, `${name} 뒤 칸이 포커스를 다시 가져감`).not.toBeFocused();
  });
}
