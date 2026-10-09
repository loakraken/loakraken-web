import assert from "node:assert/strict";
import test from "node:test";
import { isCritSpeedEnabled } from "../lib/tools/flags";

test("crit-speed is hidden only on an explicit production SITE_URL unless overridden", () => {
  assert.equal(isCritSpeedEnabled({}), true, "local and e2e (no SITE_URL)");
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://staging.loakraken.gg" }), true);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg" }), false);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg/" }), false);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg", CRIT_SPEED_TOOL: " ON " }), true);
  assert.equal(isCritSpeedEnabled({ CRIT_SPEED_TOOL: "off" }), false);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg", CRIT_SPEED_TOOL: "yes" }), false, "unknown values keep the default");
});
