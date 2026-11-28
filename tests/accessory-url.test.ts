// M51 follow-up (PM 총괄 11-22 13:31): 장신구 매물 검색's conditions in the address, checked against the model.
import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESSORY_ENLIGHTENMENT_CODEC,
  ACCESSORY_GRADE_CODEC,
  ACCESSORY_POLISH_CODEC,
  ACCESSORY_QUALITY_CODEC,
  ACCESSORY_RANGE_CODEC,
  ACCESSORY_ROLE_CODEC,
  ACCESSORY_SLOT_CODEC,
} from "../lib/tools/accessory-url";

test("부위·등급·역할: only the model's ids", () => {
  assert.equal(ACCESSORY_SLOT_CODEC.parse("RING"), "RING");
  assert.equal(ACCESSORY_SLOT_CODEC.parse("ring"), null);
  assert.equal(ACCESSORY_GRADE_CODEC.parse("RELIC"), "RELIC");
  assert.equal(ACCESSORY_GRADE_CODEC.parse("EPIC"), null);
  assert.equal(ACCESSORY_ROLE_CODEC.parse("SUPPORT"), "SUPPORT");
  assert.equal(ACCESSORY_ROLE_CODEC.parse("TANK"), null);
});

test("깨달음·힘민지 범위·품질: 상관없음 or a step the screen offers", () => {
  assert.equal(ACCESSORY_ENLIGHTENMENT_CODEC.parse("ANY"), "ANY");
  assert.equal(ACCESSORY_ENLIGHTENMENT_CODEC.parse("13"), "13");
  assert.equal(ACCESSORY_ENLIGHTENMENT_CODEC.parse("14"), null);
  assert.equal(ACCESSORY_ENLIGHTENMENT_CODEC.parse("0"), null);
  assert.equal(ACCESSORY_RANGE_CODEC.parse("70"), "70");
  assert.equal(ACCESSORY_RANGE_CODEC.parse("75"), null);
  assert.equal(ACCESSORY_QUALITY_CODEC.parse("90"), "90");
  assert.equal(ACCESSORY_QUALITY_CODEC.parse("100"), null);
});

test("연마 효과: 'OPTION:VALUE' pairs, sorted, 상관없음 left out, anything else dropped", () => {
  const { format, parse } = ACCESSORY_POLISH_CODEC;
  assert.equal(format({ ADDITIONAL_DAMAGE: "HIGH", ENEMY_DAMAGE: "ANY" }), "ADDITIONAL_DAMAGE:HIGH,ENEMY_DAMAGE:ANY");
  assert.equal(format({ ENEMY_DAMAGE: "OFF", CRIT_RATE: "MID" }), "CRIT_RATE:MID");
  assert.equal(format({}), "");
  assert.deepEqual(parse("ENEMY_DAMAGE:HIGH,CRIT_RATE:ANY"), { ENEMY_DAMAGE: "HIGH", CRIT_RATE: "ANY" });
  // An option or level the model lacks, OFF (the default), extra parts, junk: left out, the rest kept.
  assert.deepEqual(parse("NOPE:HIGH,ENEMY_DAMAGE:TOP,CRIT_RATE:OFF,ADDITIONAL_DAMAGE:LOW:x,ATTACK_PERCENT:MID,,x"), {
    ATTACK_PERCENT: "MID",
  });
  assert.deepEqual(parse(""), {});
  const picks = { CRIT_DAMAGE: "LOW", WEAPON_ATTACK_PERCENT: "ANY" } as const;
  assert.deepEqual(parse(format(picks)), picks);
});
