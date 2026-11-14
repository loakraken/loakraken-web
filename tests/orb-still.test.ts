import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ORB_STILL, ORB_STILL_SIZE } from "../components/landing/orb-still-data";

// codex #1633 P3: the loading orb's still frame is generated data. If the installed thinking-orbs draws a
// different frame (an upgrade), or its light and dark recordings stop matching, the data is stale: fail here,
// not on a user's screen.
test("orb still data is what the installed thinking-orbs draws", () => {
  const script = fileURLToPath(new URL("../scripts/gen-orb-still.mjs", import.meta.url));
  const out = execFileSync(process.execPath, [script, "--check"], { encoding: "utf8" });
  assert.match(out, /matches thinking-orbs/);
});

test("orb still data: every dot inside the 64px box, colours for both themes", () => {
  assert.equal(ORB_STILL_SIZE, 64);
  let dots = 0;
  for (const group of ORB_STILL) {
    assert.match(group.light, /^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
    assert.match(group.dark, /^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
    assert.ok(group.width > 0 && group.width < 8, `dot width ${group.width}`);
    for (const [, x, y] of group.d.matchAll(/M([\d.]+) ([\d.]+)h\.01/g)) {
      dots += 1;
      assert.ok(+x - group.width / 2 >= 0 && +x + group.width / 2 <= 64, `x ${x}`);
      assert.ok(+y - group.width / 2 >= 0 && +y + group.width / 2 <= 64, `y ${y}`);
    }
  }
  assert.equal(dots, 204);
});
