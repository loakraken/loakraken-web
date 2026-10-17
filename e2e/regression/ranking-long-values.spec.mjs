// 회귀(A37, QA 10-17 20시 실제 데이터): 랭킹 표의 숫자 칸(아이템 레벨·전투력·최고 전투력·상위 %·티어)은
// 실제 데이터 길이(11,170.05 굵은 글씨, '0.11% 크라켄')에서도 말줄임 없이 다 보이고, 글자 칸은 잘려도
// 전체 글이 툴팁(title)으로 남는다. 목의 '디스트로이어'가 실제 데이터 길이의 값을 준다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const pages = [
  ["캐릭터 랭킹", `/rankings?className=${encodeURIComponent("디스트로이어")}`],
  ["효율 랭킹", `/rankings?type=efficiency&className=${encodeURIComponent("디스트로이어")}`],
];

for (const width of [1280, 360])
  for (const [name, path] of pages)
    test(`@A37 ${width} ${name}: 숫자는 다 보이고, 잘린 글은 툴팁 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, path);
      const table = page.locator("main table").first();
      await expect(table.locator("tbody tr").first()).toBeVisible();
      await expect(table).toContainText("무라타Himek0");
      const found = await table.evaluate((el) => {
        const cut = (cell) => cell.scrollWidth > cell.clientWidth + 1;
        const numbers = [];
        const untitled = [];
        for (const cell of el.querySelectorAll("tbody td, tbody th, thead th")) {
          const text = cell.textContent.trim();
          if (!cut(cell)) continue;
          const isText = cell.matches("tbody th[scope=row]") || [...cell.classList].some((c) => /(^|_)left(_|$)/.test(c));
          if (!isText || cell.closest("thead")) numbers.push(text);
          else if (cell.getAttribute("title") !== text) untitled.push(text);
        }
        return { numbers: [...new Set(numbers)], untitled: [...new Set(untitled)] };
      });
      expect(found.numbers, "잘린 숫자·머리 칸").toEqual([]);
      expect(found.untitled, "잘렸는데 전체 글 툴팁이 없는 글자 칸").toEqual([]);
    });
