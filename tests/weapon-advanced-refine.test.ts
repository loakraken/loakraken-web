// 무기 상급 재련(PM 총괄 11-21, 계산 검증 04:36 PASS): 업화 무기만 열고, 전율 · 에스더 · 특수 · 결단 무기는 칸을 숨긴다.
// 스위치 없음. 프록시는 상급 재련을 정확한 필드 · 범위로만 받고, 무기와 방어구 순번을 가를 수 없어 방어구 순번도
// 지나간다: 방어구 상급 재련을 막는 것은 api의 방어구 스위치다(백엔드가 지킨다).
import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVANCED_REFINE_MAX,
  NO_EDITS,
  isAdvancedRefineOpen,
  isUpgradeGear,
  parseSimulateRequest,
  toChanges,
  type Current,
} from "../lib/combat-power/model";

test("업화 is the api's rule: the item name has 업화", () => {
  assert.equal(isUpgradeGear("+16 업화 칼날 무기"), true);
  assert.equal(isUpgradeGear("+20 운명의 전율 무기"), false);
  assert.equal(isUpgradeGear("+25 에스더 무기"), false);
  assert.equal(isUpgradeGear(null), false);
});

test("the weapon's 상급 재련 opens only when it is 업화; armour's still needs ARMOR_CP_SIM", () => {
  assert.equal(isAdvancedRefineOpen("무기", false, true), true);
  assert.equal(isAdvancedRefineOpen("무기", true, false), false);
  assert.equal(isAdvancedRefineOpen("무기"), false);
  assert.equal(isAdvancedRefineOpen("투구", false, true), false);
  assert.equal(isAdvancedRefineOpen("투구", true), true);
});

test("the change builder sends an 업화 weapon's 상급 재련, inside 0..40, and nothing for other weapons", () => {
  const upgrade: Current = { gems: [], gear: [{ index: 0, type: "무기", refine: 16, quality: 90, advanced: 21, upgrade: true }] };
  assert.deepEqual(toChanges({ ...NO_EDITS, advanced: { 0: 30 } }, upgrade), [{ kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 30 }]);
  assert.deepEqual(toChanges({ ...NO_EDITS, advanced: { 0: 21 } }, upgrade), []);
  assert.deepEqual(toChanges({ ...NO_EDITS, advanced: { 0: ADVANCED_REFINE_MAX + 1 } }, upgrade), []);
  const other = { ...upgrade, gear: [{ ...upgrade.gear[0], upgrade: false }] };
  assert.deepEqual(toChanges({ ...NO_EDITS, advanced: { 0: 30 } }, other), []);
});

test("the proxy takes 상급 재련 with exactly index + level inside 0..40, for any index (the api's armour switch holds armour)", () => {
  const body = (change: Record<string, unknown>) => ({ characterName: "기준캐릭터A", changes: [change] });
  for (const armor of [false, true]) {
    assert.deepEqual(parseSimulateRequest(body({ kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 40 }), { armor })?.changes, [
      { kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 40 },
    ]);
    // An armour index passes the proxy too: it cannot tell the weapon's position from armour's.
    assert.deepEqual(parseSimulateRequest(body({ kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 10 }), { armor })?.changes, [
      { kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 10 },
    ]);
    for (const bad of [
      { kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 41 },
      { kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: -1 },
      { kind: "EQUIPMENT_ADVANCED_REFINE", index: -1, level: 10 },
      { kind: "EQUIPMENT_ADVANCED_REFINE", index: 0 },
      { kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 10, refine: 20 },
      { kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 10.5 },
    ])
      assert.equal(parseSimulateRequest(body(bad), { armor }), null, JSON.stringify(bad));
  }
});
