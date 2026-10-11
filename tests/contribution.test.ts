import assert from "node:assert/strict";
import test from "node:test";
import DATA from "../lib/tools/data/raid-contribution.json";
import { GATES, RAIDS, difficultiesOf, formatEok, gatesOf, parseDamage, position } from "../lib/tools/contribution";

test("every gate has a lower bound under its upper bound and a basis date", () => {
  assert.equal(GATES.length, 43);
  for (const g of GATES) {
    if (g.status === "HOLD") {
      // 계산 검증 10-12: unsettled gates carry no numbers at all.
      assert.equal(g.low, null);
      assert.equal(g.high, null);
      continue;
    }
    assert.ok(g.low != null && g.high != null && g.low > 0 && g.high > g.low, `${g.raid} ${g.difficulty} ${g.gate}`);
    if (g.reference != null) assert.ok(g.reference > g.low && g.reference < g.high);
    assert.match(g.basisDate, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("position matches the verified expectations (계산 검증 PR #380)", () => {
  for (const v of DATA.positionVectors) {
    // "세르카 하드 1관문" → that gate's own range from the data.
    const [raid, difficulty, gateText] = v.gate.split(" ");
    const g = GATES.find((x) => x.raid === raid && x.difficulty === difficulty && x.gate === Number(gateText.replace("관문", "")))!;
    assert.equal(g.status, "CONFIRMED");
    const got = position(v.myDamage, { low: g.low!, high: g.high! });
    assert.equal(got.pct, v.positionPct, v.gate + " " + v.myDamage);
    assert.equal(got.band, v.band);
  }
});

test("six gates are on hold (계산 검증 10-12)", () => {
  assert.deepEqual(
    GATES.filter((g) => g.status === "HOLD").map((g) => `${g.raid} ${g.difficulty} ${g.gate}`),
    ["4막 노말 1", "4막 하드 1", "4막 하드 2", "종막 노말 1", "종막 노말 2", "3막 익스트림 하드 1"],
  );
});

test("raids, difficulties and gates come out in the sample's order", () => {
  assert.equal(RAIDS[0], "1막");
  assert.deepEqual(difficultiesOf("세르카"), ["노말", "하드", "나이트메어"]);
  assert.deepEqual(gatesOf("4막", "하드").map((g) => g.gate), [1, 2]);
});

test("damage input accepts commas and 억, rejects junk", () => {
  assert.equal(parseDamage(""), null);
  assert.equal(parseDamage("1,740.4"), 1740.4);
  assert.equal(parseDamage("2088억"), 2088);
  assert.ok(Number.isNaN(parseDamage("12a")));
  assert.ok(Number.isNaN(parseDamage("-5")));
  assert.equal(formatEok(1566.4), "1,566.4억");
});
