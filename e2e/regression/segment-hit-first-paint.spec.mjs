// 회귀(develop CI 42488898798, 수집품 단상 320 dark): 첫 페이지가 나뉘어 오면 조건 막대의 단추(원정대·캐릭터 같은 묶음
// 단추)가 글자보다 먼저 그려질 수 있다. 휴대폰에서 단추의 누르는 영역(44px, ::after)이 단추 가운데에 맞춰져 있어, 글자가
// 와 단추가 넓어질 때 영역의 왼쪽 끝이 8px 옮겨 갔다(26,298 44x44 → 34,308 64x44, 깨기 203ms 전). 이제 영역은 단추의
// 왼쪽 끝에 붙어 있어 단추가 넓어져도 옮겨 가지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

/**
 * Plays a segment arriving in parts, in page order: its first button without its label, then the label, then the
 * next buttons. Returns the layout shift recorded meanwhile (the hit area's ::after included).
 */
const segmentArriving = async (page, name) => {
  const group = page.getByRole("group", { name, exact: true }).first();
  // Take the later parts out first (not a first-paint event, so before the mark).
  await group.evaluate(async (el) => {
    const [first, ...later] = [...el.children];
    const label = [...first.childNodes];
    for (const button of later) button.remove();
    for (const node of label) node.remove();
    window.__segmentParts = { el, first, label, later };
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const mark = await shiftMark(page);
  await page.evaluate(async () => {
    const { el, first, label, later } = window.__segmentParts;
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const node of label) {
      first.append(node);
      await frame();
    }
    for (const button of later) {
      el.append(button);
      await frame();
    }
  });
  return shiftsSince(page, mark);
};

for (const width of [320, 390])
  for (const [path, name] of [
    ["/rankings?type=collectibles", "단위"],
    ["/rankings", "기준"],
  ])
    test(`@A7 ${width} ${path} '${name}' 단추가 글자보다 먼저 그려져도 누르는 영역이 옮겨 가지 않는다 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, path);
      await expect(page.getByRole("group", { name, exact: true }).first()).toBeVisible();
      await page.waitForTimeout(400);
      const moved = await segmentArriving(page, name);
      expect(moved.all, `나뉘어 온 단추가 민 것 (${moved.moved})`).toBe(0);
    });
