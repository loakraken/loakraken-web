import assert from "node:assert/strict";
import test from "node:test";
import { isCritSpeedEnabled } from "../lib/tools/flags";

test("crit-speed is hidden only on an explicit production SITE_URL unless overridden", () => {
  assert.equal(isCritSpeedEnabled({}), true, "local and e2e (no SITE_URL)");
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://staging.loakraken.gg" }), true);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg" }), false);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg/" }), false);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://www.loakraken.gg" }), false, "www host");
  assert.equal(isCritSpeedEnabled({ SITE_URL: "http://LOAKRAKEN.GG:8080/x" }), false, "any scheme/port/path on the host");
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg.example.com" }), true);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "not a url" }), true);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg", CRIT_SPEED_TOOL: " ON " }), true);
  assert.equal(isCritSpeedEnabled({ CRIT_SPEED_TOOL: "off" }), false);
  assert.equal(isCritSpeedEnabled({ SITE_URL: "https://loakraken.gg", CRIT_SPEED_TOOL: "yes" }), false, "unknown values keep the default");
});

test("receipt: hidden only on production unless RECEIPT_TOOL says otherwise", async () => {
  const { isReceiptEnabled } = await import("../lib/tools/flags");
  assert.equal(isReceiptEnabled({}), true, "local and e2e (no SITE_URL)");
  assert.equal(isReceiptEnabled({ SITE_URL: "https://staging.loakraken.gg" }), true);
  assert.equal(isReceiptEnabled({ SITE_URL: "https://loakraken.gg" }), false);
  assert.equal(isReceiptEnabled({ SITE_URL: "https://www.loakraken.gg/" }), false);
  assert.equal(isReceiptEnabled({ SITE_URL: "https://loakraken.gg", RECEIPT_TOOL: "on" }), true);
  assert.equal(isReceiptEnabled({ RECEIPT_TOOL: " OFF " }), false);
});
