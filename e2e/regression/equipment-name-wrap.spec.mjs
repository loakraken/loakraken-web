// 회귀(A37, v0.3.10 RC): 휴대폰 장비 카드에서 장비 이름이 글자마다 줄이 바뀌지 않는다. 장신구·스톤의 효과 줄이 오른쪽에
// 그대로 있어도(사용자 11-01 배치) 이름 칸이 효과 줄이 남긴 폭만 가져, 320에서 '귀걸이'가 19px 칸에 한 글자씩
// 세 줄(귀/걸/이), '목걸이'가 '목걸 / 이'로 끊겼다(깨기 전). 이제 이름의 첫 낱말은 한 줄이고 효과 줄이 한 줄 더 감긴다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const who of ["상세", "전투력계산"])
  for (const width of [320, 360, 390])
    test(`@A37 ${width} 장비 이름이 글자마다 끊기지 않는다 (${who}) @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, characterPath(who));
      const panel = page.getByRole("region", { name: "장비", exact: true });
      await expect(panel.locator("li strong").first()).toBeVisible();
      // Each row name's first word (the slot or item name, before the tier): the lines its letters sit on.
      const names = await panel.locator("li strong").evaluateAll((els) =>
        els.map((el) => {
          const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
          if (!node) return null;
          const word = node.textContent.trim().split(/\s+/)[0];
          const start = node.textContent.indexOf(word);
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + word.length);
          const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
          return { word, lines: tops.size };
        }),
      );
      const split = names.filter((n) => n && n.lines !== 1);
      expect(names.filter(Boolean).length, "이름이 있는 줄").toBeGreaterThanOrEqual(5);
      expect(split, "글자 사이에서 끊긴 이름").toEqual([]);
      // The accessory and stone effect lines stay on the right of the name (user 11-01).
      const lines = await panel.locator("li:has(> ul)").evaluateAll((rows) =>
        rows.map((row) => {
          const list = row.querySelector(":scope > ul").getBoundingClientRect();
          const name = row.querySelector("strong").getBoundingClientRect();
          return { right: Math.abs(list.right - row.getBoundingClientRect().right) <= 1, beside: list.left >= name.right };
        }),
      );
      expect(lines.length, "효과 줄이 있는 줄").toBeGreaterThan(0);
      expect(lines.filter((l) => !l.right || !l.beside), "효과 줄은 이름 오른쪽").toEqual([]);
      const { all, moved } = await shiftsSince(page);
      expect(all, `흔들림 (${moved})`).toBe(0);
      await expectNoHorizontalOverflow(page);
    });
