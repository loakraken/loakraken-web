import assert from "node:assert/strict";
import test from "node:test";
import { checkRate, goldPerRoyal, parseRate } from "../lib/tools/crystal-rate";
import { parseRate as shopParseRate, SHOP_DATA } from "../lib/tools/loa-shop";

test("crystal rate: one parser for the 로아샵 계산기 and the 시세 card (X6)", () => {
  assert.equal(shopParseRate, parseRate);
  assert.equal(parseRate(""), null);
  assert.equal(parseRate("27,300"), 27300);
});

test("crystal rate: nothing is stripped silently — a sign, a decimal point or stray commas are invalid (codex P2 on #1889)", () => {
  const ok = (rate: number) => ({ rate, invalid: false });
  const bad = { rate: null, invalid: true };
  assert.deepEqual(checkRate(""), { rate: null, invalid: false });
  assert.deepEqual(checkRate("   "), { rate: null, invalid: false });
  assert.deepEqual(checkRate("27300"), ok(27300));
  assert.deepEqual(checkRate("27,300"), ok(27300));
  assert.deepEqual(checkRate(" 27300 "), ok(27300));
  assert.deepEqual(checkRate("1,027,300"), ok(1027300));
  assert.deepEqual(checkRate("-27300"), bad); // not 27300
  assert.deepEqual(checkRate("+27300"), bad);
  assert.deepEqual(checkRate("1.5"), bad); // not 15
  assert.deepEqual(checkRate("2,73,00"), bad); // not 27300
  assert.deepEqual(checkRate("27,30"), bad);
  assert.deepEqual(checkRate(",273"), bad);
  assert.deepEqual(checkRate("27 300"), bad);
  assert.deepEqual(checkRate("0"), bad);
  assert.deepEqual(checkRate("0,000"), bad);
  assert.deepEqual(checkRate("99999999999999999999"), bad); // past the safe range
  assert.deepEqual(checkRate("abc"), bad);
});

test("crystal rate: gold per royal crystal = gold per 100 blue ÷ royal per 100 blue (official shop)", () => {
  assert.equal(SHOP_DATA.crystal.royalPer100, 2750);
  // 27,300 gold for 100 blue crystals, 2,750 royal crystals for 100 blue crystals → 9.927… gold per royal crystal.
  assert.ok(Math.abs(goldPerRoyal(27300, SHOP_DATA.crystal.royalPer100) - 9.92727) < 1e-4);
  assert.equal(goldPerRoyal(2750, 2750), 1);
  // The card's source is a known official source with a check date.
  const source = SHOP_DATA.sources[SHOP_DATA.crystal.source];
  assert.match(source.url, /^https:\/\/lostark\.game\.onstove\.com\//);
  assert.match(source.date, /^\d{4}-\d{2}-\d{2}$/);
});
