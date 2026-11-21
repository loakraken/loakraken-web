// M51 (PM 총괄 11-21): what the raid tools keep in the address is checked against the static data.
import assert from "node:assert/strict";
import test from "node:test";
import {
  CHEATSHEET_DIFFICULTY_CODEC,
  CHEATSHEET_GATE_CODEC,
  CHEATSHEET_RAID_CODEC,
  RAID_DIFFICULTIES_CODEC,
  RAID_FILTER_CODEC,
} from "../lib/tools/raid-url";

test("레이드 보상표 card picks: sorted pairs out, only pairs the data has come back", () => {
  const { format, parse } = RAID_DIFFICULTIES_CODEC;
  assert.equal(format({ "kazeros-act2": "HARD", "kazeros-act1": "SINGLE" }), "kazeros-act1:SINGLE,kazeros-act2:HARD");
  assert.equal(format({}), "");
  assert.deepEqual(parse("kazeros-act1:HARD,kazeros-act2:NORMAL"), { "kazeros-act1": "HARD", "kazeros-act2": "NORMAL" });
  // A raid the data lacks, a difficulty the raid lacks (베히모스 has only NORMAL), junk: left out, the rest kept.
  assert.deepEqual(parse("nope:HARD,behemoth:HARD,kazeros-act1:HARD,::,x"), { "kazeros-act1": "HARD" });
  assert.deepEqual(parse(""), {});
  // Round trip.
  const picks = { behemoth: "NORMAL", "kazeros-prologue": "SINGLE" } as const;
  assert.deepEqual(parse(format(picks)), picks);
});

test("레이드 보상표 filter and 레이드 컨닝페이퍼 raid, difficulty and gate take only what the data has", () => {
  assert.equal(RAID_FILTER_CODEC.parse("KAZEROS"), "KAZEROS");
  assert.equal(RAID_FILTER_CODEC.parse("kazeros"), null);
  assert.equal(CHEATSHEET_RAID_CODEC.parse("serka"), "serka");
  assert.equal(CHEATSHEET_RAID_CODEC.parse("behemoth"), null);
  assert.equal(CHEATSHEET_DIFFICULTY_CODEC.parse(""), "");
  assert.equal(CHEATSHEET_DIFFICULTY_CODEC.parse("NIGHTMARE"), "NIGHTMARE");
  assert.equal(CHEATSHEET_DIFFICULTY_CODEC.parse("EASY"), null);
  assert.equal(CHEATSHEET_GATE_CODEC.parse("2"), 2);
  assert.equal(CHEATSHEET_GATE_CODEC.parse("0"), null);
  assert.equal(CHEATSHEET_GATE_CODEC.parse("2.5"), null);
});
