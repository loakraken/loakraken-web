import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "../app/sitemap";
import { GET } from "../app/api/flags/route";
import { NAV_SECTIONS } from "../components/site/nav-data";

function withFlag<T>(value: string, run: () => T) {
  const before = process.env.CRIT_SPEED_TOOL;
  process.env.CRIT_SPEED_TOOL = value;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env.CRIT_SPEED_TOOL;
    else process.env.CRIT_SPEED_TOOL = before;
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
  assert.deepEqual(await withFlag("off", GET).json(), { critSpeed: false });
  assert.deepEqual(await withFlag("on", GET).json(), { critSpeed: true });
  const links = NAV_SECTIONS.flatMap((section) => section.groups.flatMap((group) => group.links));
  assert.equal(links.find((link) => link.href === "/tools/crit-speed")?.flag, "critSpeed");
});
