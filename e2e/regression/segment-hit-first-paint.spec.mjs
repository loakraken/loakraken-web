// 회귀(develop CI 42488898798, 수집품 단상 320 dark): 첫 페이지가 나뉘어 오면 조건 막대의 단추(원정대·캐릭터 같은 묶음
// 단추)가 글자보다 먼저 그려질 수 있다. 휴대폰에서 단추의 누르는 영역(44px, ::after)이 단추 가운데에 맞춰져 있어, 글자가
// 와 단추가 넓어질 때 영역의 왼쪽 끝이 8px 옮겨 갔다(26,298 44x44 → 34,308 64x44, 깨기 203ms 전). 이제 영역은 단추의
// 왼쪽 끝에 붙어 있어, 글자가 있든 없든 왼쪽 끝이 같고 단추가 넓어져도 옮겨 가지 않는다(44px 너비는 그대로).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Where the first button's hit area reaches, read by hit testing beside its left edge and at 44px. */
const hitArea = (group) =>
  group.evaluate((el) => {
    const button = el.querySelector("button");
    const r = button.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const at = (x) => {
      const hit = document.elementFromPoint(x, y);
      return hit === button || button.contains(hit);
    };
    return { leftOfEdge: at(r.left - 3), atEdge: at(r.left + 3), at44: at(r.left + 43) };
  });

for (const width of [320, 390])
  for (const [path, name] of [
    ["/rankings?type=collectibles", "단위"],
    ["/rankings", "기준"],
  ])
    test(`@A7 ${width} ${path} '${name}' 단추가 글자보다 먼저 그려져도 누르는 영역의 왼쪽 끝이 같다 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, path);
      const group = page.getByRole("group", { name, exact: true }).first();
      await expect(group).toBeVisible();
      // With its label: the area starts at the button's own left edge.
      expect(await hitArea(group), "글자가 있을 때").toEqual({ leftOfEdge: false, atEdge: true, at44: true });
      // As first painted before the label arrives (a narrow button): the same start, still 44px wide.
      await group.evaluate((el) => {
        const button = el.querySelector("button");
        button.dataset.label = button.textContent;
        button.textContent = "";
      });
      expect(await hitArea(group), "글자가 오기 전").toEqual({ leftOfEdge: false, atEdge: true, at44: true });
    });
