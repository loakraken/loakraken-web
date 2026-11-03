// 회귀(QA v0.3.8 RC P2): 같은 순위가 있으면(실제 수집품 랭킹: 1위 둘, 2위 없음) 시상대가 빈 340px
// 상자로 그려졌다. 이제 시상대는 표의 위 세 줄을 표 순서대로 보이고, 카드마다 실제 순위(1위·1위·3위)와
// 그 메달을 단다. 빈 상자가 생기지 않고, 320·360·1280 × 라이트·다크에서 흔들림 0.
// (효율 랭킹은 서버에서 그려 목 응답을 바꿀 수 없다: 같은 podiumTop을 단위 검사가 본다.)
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince } from "../support/shifts.mjs";

const LISTS = [
  { name: "수집품", path: "/rankings?type=collectibles", api: "/api/rankings/collectibles", full: true },
  { name: "캐릭터", path: "/rankings", api: "/api/rankings" },
  { name: "원정대", path: "/rankings?type=roster", api: "/api/rankings/rosters" },
  { name: "길드", path: "/rankings?type=guilds&sort=CP_SUM", api: "/api/rankings/guilds" },
];
const TIES = [[1, 1, 3], [1, 2, 2], [1, 1, 1]];
const podiumOf = (page) => page.locator("[data-rank-podium]");

for (const list of LISTS)
  for (const ranks of TIES)
    for (const width of list.full ? [320, 360, 1280] : [360])
      for (const theme of list.full ? ["light", "dark"] : ["light"])
        test(`${list.name} 같은 순위 ${ranks.join(",")} ${width} ${theme}: 표 위 세 줄 그대로, 실제 순위, 빈 상자 없음 @regression`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), theme);
          await watchShifts(page);
          await page.route((url) => url.pathname === list.api, async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            ranks.forEach((rank, i) => { json.envelope.data.rows[i].rank = rank; });
            await route.fulfill({ response, json });
          });
          await gotoReady(page, list.path);
          const podium = podiumOf(page);
          await expect(podium).toHaveAttribute("data-podium-state", "ready");
          const places = podium.locator("[data-podium-place]");
          await expect(places).toHaveCount(3);
          // The table's first three rows, in its order.
          const table = page.getByRole("table").first();
          const names = await table.locator("tbody tr").evaluateAll((rows) => rows.slice(0, 3).map((row) => row.querySelector("th a, td a")?.textContent?.trim()));
          for (let slot = 0; slot < 3; slot++) {
            const place = podium.locator(`[data-podium-place="${slot + 1}"]`);
            await expect(place.locator("[data-podium-name]")).toHaveText(names[slot]);
            await expect(place.locator("[data-podium-block]")).toHaveText(`${ranks[slot]}위`);
            await expect(place).toHaveAttribute("data-podium-medal", String(ranks[slot]));
            await expect(place.locator(`svg[data-place="${ranks[slot]}"]`)).toHaveCount(1);
          }
          // Two golds for a tie at 1: the card's colour is its rank's, not its slot's.
          const medals = await places.evaluateAll((els) => els.map((el) => getComputedStyle(el).getPropertyValue("--medal").trim()));
          expect(medals[0]).toBe(ranks[1] === 1 ? medals[1] : medals[0]);
          if (ranks[1] === ranks[0]) expect(medals[1]).toBe(medals[0]);
          await page.waitForTimeout(600);
          const shift = await shiftsSince(page);
          expect(shift.all, `흔들림 (${shift.moved})`).toBe(0);
        });
