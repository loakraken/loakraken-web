// 회귀(X3, PM 총괄 11-22): 재련 계산기 목표 단계의 목표 아이템 레벨 슬라이더와 '고른 부위 +1'. 슬라이더는 계산에 넣은
// 여섯 부위(완갑 제외)의 목표를 낮은 부위부터 고르게 올리고, 끄는 동안에는 계산 요청을 보내지 않으며 놓을 때 한 번만
// 보낸다. 한 단계는 평균 아이템 레벨 +5/6. 고른 부위는 주소에 남고 +1은 고른 부위만 한 단계씩 올린다. 흔들림 0.
import { test, expect, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

/** Settled: the page woke (root effect), the network is quiet, fonts are in and two frames are drawn. */
async function settled(page) {
  await page.waitForFunction(() => window.__lkHydrated);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
}

const PLANS = "/api/refining/plans";
const LEVEL_PARTS = ["무기", "머리", "상의", "하의", "장갑", "어깨"];

/** The stages a part goes up, from its row's head ('+N단계', '유지' = 0, '제외' = null). */
const upOf = (page, label) =>
  page
    .locator("li")
    .filter({ has: page.locator("strong", { hasText: new RegExp(`^${label}$`) }) })
    .locator("span")
    .first()
    .innerText()
    .then((text) => (text === "제외" ? null : text === "유지" ? 0 : Number(text.match(/\+(\d+)단계/)[1])));

for (const width of [320, 1280])
  test(`${width}: 목표 아이템 레벨 슬라이더 — 놓을 때만 계산, 여섯 부위에 고르게, 주소에 남음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    const plans = [];
    page.on("request", (request) => request.url().includes(PLANS) && plans.push(request.postData() ?? ""));
    await gotoReady(page, "/tools/refining");
    const slider = page.getByRole("slider", { name: /목표 아이템 레벨/ });
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("aria-valuetext", /, 0단계 올림$/);
    // Ready: woken, network quiet, fonts in, two frames drawn (no fixed wait, codex P3 on #1922).
    await settled(page);
    const first = await shiftsSince(page);
    expect(first.all, `첫 로드 흔들림: ${first.moved}`).toBe(0);

    // Drag: no plan request while the thumb moves, one round when it is let go. (At 320 the slider is below the fold:
    // the mouse works in the viewport, so bring it into view first.)
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 4, y);
    await page.mouse.down();
    const before = plans.length;
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + (box.width * i) / 16, y);
    await settled(page);
    expect(plans.length, "끄는 동안 계산 요청 없음").toBe(before);
    await page.mouse.up();

    const valueText = await slider.getAttribute("aria-valuetext");
    const stages = Number(valueText.match(/, (\d+)단계 올림$/)[1]);
    expect(stages).toBeGreaterThan(0);
    const ups = [];
    for (const label of LEVEL_PARTS) ups.push(await upOf(page, label));
    expect(ups.reduce((a, b) => a + b, 0), `부위별 올림 ${ups}`).toBe(stages);
    expect(Math.max(...ups) - Math.min(...ups), `고르게: ${ups}`).toBeLessThanOrEqual(1);
    // Exactly one plan request per distinct plan the release made, none twice (codex P3 on #1922): parts with the same
    // plan (the armour parts at the same grade and stages; the weapon is its own) share one cached request.
    const changed = new Set(LEVEL_PARTS.flatMap((label, i) => (ups[i] > 0 ? [`${label === "무기" ? "WEAPON" : "ARMOR"}:${ups[i]}`] : []))).size;
    await expect.poll(() => plans.length - before).toBe(changed);
    await settled(page);
    const sent = plans.slice(before);
    expect(sent.length, "놓은 뒤 계산 요청 수").toBe(changed);
    expect(new Set(sent).size, "같은 요청을 두 번 보내지 않음").toBe(sent.length);
    // The shown gain: stages × 5 ÷ 6.
    await expect(page.locator("output").first()).toHaveText(`+${((stages * 5) / 6).toFixed(2)}`);

    // Kept in the address: a reload comes back to the same targets and slider.
    await page.reload();
    await expect(page.getByRole("slider", { name: /목표 아이템 레벨/ })).toHaveAttribute("aria-valuetext", valueText);
    await expectNoHorizontalOverflow(page);
  });

test("320: 고른 부위 +1 — 고른 부위만 한 단계씩, 고른 것은 주소에, 제외한 부위는 고를 수 없다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/tools/refining");
  const group = page.getByRole("group", { name: "고른 부위 한 번에 올리기" });
  const raise = group.getByRole("button", { name: "고른 부위 +1" });
  await expect(raise).toHaveAttribute("aria-disabled", "true");
  await group.getByRole("button", { name: "무기", exact: true }).click();
  await group.getByRole("button", { name: "장갑", exact: true }).click();
  await expect(group.getByRole("button", { name: "무기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/[?&]pick=weapon%2Cgloves|[?&]pick=weapon,gloves/);
  await raise.click();
  await expect.poll(() => upOf(page, "무기")).toBe(1);
  await expect.poll(() => upOf(page, "장갑")).toBe(1);
  expect(await upOf(page, "머리")).toBe(0);
  await raise.click();
  await expect.poll(() => upOf(page, "무기")).toBe(2);

  // An excluded part cannot be picked.
  await page
    .locator("li")
    .filter({ has: page.locator("strong", { hasText: /^어깨$/ }) })
    .getByRole("checkbox", { name: "계산에 포함" })
    .uncheck();
  await expect(group.getByRole("button", { name: "어깨", exact: true })).toBeDisabled();

  // The picks come back with the address.
  await page.reload();
  await expect(page.getByRole("group", { name: "고른 부위 한 번에 올리기" }).getByRole("button", { name: "장갑", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoHorizontalOverflow(page);
});

// codex P2 on #1922: dragged back to where it started and let go, the slider fires no change event. Its leftover
// position must not hide the next change made elsewhere: after '고른 부위 +1' the shown level follows the plan.
test("1280: 끌었다 제자리에 놓은 뒤 +1 — 보이는 목표 아이템 레벨이 계획을 따른다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/refining");
  const slider = page.getByRole("slider", { name: /목표 아이템 레벨/ });
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 4, y, { steps: 4 });
  await expect(slider).not.toHaveAttribute("aria-valuetext", /, 0단계 올림$/);
  await page.mouse.move(box.x + 4, y, { steps: 4 });
  await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuetext", /, 0단계 올림$/);
  expect(await upOf(page, "무기"), "아무것도 정하지 않음").toBe(0);
  const group = page.getByRole("group", { name: "고른 부위 한 번에 올리기" });
  await group.getByRole("button", { name: "무기", exact: true }).click();
  await group.getByRole("button", { name: "고른 부위 +1" }).click();
  await expect.poll(() => upOf(page, "무기")).toBe(1);
  // One stage: +5 ÷ 6 on the average.
  await expect(page.locator("output").first()).toHaveText("+0.83");
  await expect(slider).toHaveAttribute("aria-valuetext", /, 1단계 올림$/);
});

// #1929 (codex P3 on #1922): a key let go mid-drag that does not move the slider (Shift) keeps the thumb where it is.
test("1280: 끄는 도중 Shift를 떼도 손잡이가 그 자리에 있다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/refining");
  const slider = page.getByRole("slider", { name: /목표 아이템 레벨/ });
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 4, y, { steps: 4 });
  const held = await slider.getAttribute("aria-valuetext");
  expect(held).not.toMatch(/, 0단계 올림$/);
  await page.keyboard.down("Shift");
  await page.keyboard.up("Shift");
  // The settle runs a task later: give it a frame and a task, then read again.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 50))));
  expect(await slider.getAttribute("aria-valuetext"), "Shift를 뗀 뒤에도 끄는 자리").toBe(held);
  await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuetext", held);
});

// #1929 (codex P3 on #1922): with tied targets, a step up and a step back give back the targets it started from.
test("1280: 목표가 같은 부위가 있어도 한 칸 올렸다 내리면 처음 목표로 돌아온다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/refining");
  // Five armour parts one stage up, the weapon not: 무기 18, the others 19.
  const group = page.getByRole("group", { name: "고른 부위 한 번에 올리기" });
  for (const label of ["머리", "상의", "하의", "장갑", "어깨"]) await group.getByRole("button", { name: label, exact: true }).click();
  await group.getByRole("button", { name: "고른 부위 +1" }).click();
  await expect.poll(() => upOf(page, "어깨")).toBe(1);
  const start = [];
  for (const label of LEVEL_PARTS) start.push(await upOf(page, label));
  expect(start).toEqual([0, 1, 1, 1, 1, 1]);

  const slider = page.getByRole("slider", { name: /목표 아이템 레벨/ });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => upOf(page, "무기")).toBe(1);
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuetext", /, 5단계 올림$/);
  await expect.poll(() => upOf(page, "무기")).toBe(0);
  const back = [];
  for (const label of LEVEL_PARTS) back.push(await upOf(page, label));
  expect(back, "처음 목표 그대로").toEqual(start);
});
