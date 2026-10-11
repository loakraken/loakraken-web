import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "../app/sitemap";
import { GET } from "../app/api/flags/route";
import { NAV_SECTIONS } from "../components/site/nav-data";

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
  const links = NAV_SECTIONS.flatMap((section) => section.groups.flatMap((group) => group.links));
  assert.equal(links.find((link) => link.href === "/tools/crit-speed")?.flag, "critSpeed");
});

test("the combat-power simulator is in the menu behind its own flag (사용자 지적 10-11)", async () => {
  assert.equal((await withFlag("off", GET, "COMBAT_POWER_SIM").json()).combatPower, false);
  assert.equal((await withFlag("on", GET, "COMBAT_POWER_SIM").json()).combatPower, true);
  const tools = NAV_SECTIONS.find((section) => section.id === "tools");
  const link = tools?.groups[0].links.find((item) => item.href === "/tools/combat-power");
  assert.equal(link?.flag, "combatPower");
  assert.equal(tools?.groups[0].links[1], link, "first calculator after 도구 전체");
  assert.ok(tools?.match.includes("/tools/combat-power"));
});
