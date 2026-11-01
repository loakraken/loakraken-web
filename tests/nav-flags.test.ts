import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "../app/sitemap";
import { GET } from "../app/api/flags/route";
import { HUBS, NAV_SECTIONS, sectionOf } from "../components/site/nav-data";

function withFlag<T>(value: string, run: () => T, name = "CRIT_SPEED_TOOL") {
  const before = process.env[name];
  process.env[name] = value;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  }
}

const paths = () => sitemap().map((entry) => new URL(entry.url).pathname);

test("the sitemap leaves out the crit-speed tool while it is hidden (web #237)", () => {
  assert.ok(withFlag("on", paths).includes("/tools/crit-speed"));
  const hidden = withFlag("off", paths);
  assert.ok(!hidden.includes("/tools/crit-speed"));
  assert.ok(hidden.includes("/tools/refining"));
});

test("the menu's flag answer follows the same switch", async () => {
  assert.equal((await withFlag("off", GET).json()).critSpeed, false);
  assert.equal((await withFlag("on", GET).json()).critSpeed, true);
  const search = NAV_SECTIONS.flatMap((section) => section.search ?? []);
  assert.equal(search.find((link) => link.href === "/tools/crit-speed")?.flag, "critSpeed");
});

test("the combat-power simulator stays findable behind its own flag (사용자 지적 10-11)", async () => {
  assert.equal((await withFlag("off", GET, "COMBAT_POWER_SIM").json()).combatPower, false);
  assert.equal((await withFlag("on", GET, "COMBAT_POWER_SIM").json()).combatPower, true);
  const tools = NAV_SECTIONS.find((section) => section.id === "tools");
  assert.equal(tools?.search?.find((item) => item.href === "/tools/combat-power")?.flag, "combatPower");
  assert.ok(HUBS.growth.tabs.some((tab) => tab.href === "/tools/combat-power" && tab.flag === "combatPower"));
  assert.ok(tools?.match?.includes("/tools/combat-power"));
});

test("the menu lists hubs only (user 11-01); every page left out is a tab of a listed hub and still searchable", () => {
  const rows = (id: string) =>
    NAV_SECTIONS.find((section) => section.id === id)!.groups.flatMap((group) => group.links).filter((link) => link.href);
  assert.deepEqual(rows("market").map((link) => link.href), ["/market"]);
  assert.deepEqual(rows("tools").map((link) => [link.label, link.href]), [
    ["캐릭터 성장", "/tools/refining"],
    ["레이드", "/tools/raid-rewards"],
    ["골드 효율", "/tools/loa-shop"],
  ]);
  assert.deepEqual(rows("stats").map((link) => link.href), ["/stats"]);
  assert.equal(NAV_SECTIONS.find((section) => section.id === "tools")!.all?.href, "/tools");
  // Each hub row opens the hub's first tab.
  assert.equal(HUBS.market.tabs[0].href, "/market");
  assert.equal(HUBS.growth.tabs[0].href, "/tools/refining");
  assert.equal(HUBS.raid.tabs[0].href, "/tools/raid-rewards");
  assert.equal(HUBS.gold.tabs[0].href, "/tools/loa-shop");
  // Every page that left the menu is a tab of a hub still in it (or a /stats tab), and in the search list.
  const menu = new Set(NAV_SECTIONS.flatMap((section) => section.groups.flatMap((group) => group.links)).map((l) => l.href));
  const tabs = new Set(Object.values(HUBS).flatMap((hub) => (menu.has(hub.tabs[0].href) ? hub.tabs.map((t) => t.href) : [])));
  for (const link of NAV_SECTIONS.flatMap((section) => section.search ?? []))
    assert.ok(menu.has(link.href) || tabs.has(link.href!) || link.href!.startsWith("/stats?tab="), link.href);
  for (const hub of Object.values(HUBS))
    for (const tab of hub.tabs)
      assert.ok(menu.has(tab.href) || NAV_SECTIONS.some((section) => section.search?.some((link) => link.href === tab.href)), `${tab.href} searchable`);
  // 악세 경매 검색 stays under 시세 and marks 시세 as current.
  assert.equal(sectionOf("/market/accessory-search"), "market");
  assert.equal(sectionOf("/tools/auction"), "tools");
});
