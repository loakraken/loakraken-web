import assert from "node:assert/strict";
import test from "node:test";
import { accessoryLineCounts, gridOptionCounts } from "../lib/character/role-lines";

test("ark grid gem options: the role's family counts, the other's does not, the rest is undecided", () => {
  assert.equal(gridOptionCounts("공격력", "DEALER"), true);
  assert.equal(gridOptionCounts("보스 피해", "DEALER"), true);
  assert.equal(gridOptionCounts("아군 피해 강화", "DEALER"), false);
  assert.equal(gridOptionCounts("낙인력", "SUPPORT"), true);
  assert.equal(gridOptionCounts("추가 피해", "SUPPORT"), false);
  // No role split, or no role: nothing decided (left as it is).
  assert.equal(gridOptionCounts("의지력 효율", "DEALER"), null);
  assert.equal(gridOptionCounts("공격력", null), null);
});

test("accessory lines: core lines per role, % vs flat, utility lines for neither", () => {
  // Dealer core.
  assert.equal(accessoryLineCounts("추가 피해", "+2.60%", "DEALER"), true);
  assert.equal(accessoryLineCounts("적에게 주는 피해 증가", "+2.00%", "DEALER"), true);
  assert.equal(accessoryLineCounts("치명타 피해", "+4.00%", "SUPPORT"), false);
  // Supporter core.
  assert.equal(accessoryLineCounts("낙인력", "+8.00%", "SUPPORT"), true);
  assert.equal(accessoryLineCounts("세레나데, 신앙, 조화 게이지 획득량", "+6.00%", "SUPPORT"), true);
  assert.equal(accessoryLineCounts("아군 공격력 강화 효과", "+5.00%", "DEALER"), false);
  // 무기 공격력 %: both roles. Flat 공격력 / 무기 공격력: dealer only.
  assert.equal(accessoryLineCounts("무기 공격력", "+3.00%", "SUPPORT"), true);
  assert.equal(accessoryLineCounts("무기 공격력", "+960", "SUPPORT"), false);
  assert.equal(accessoryLineCounts("공격력", "+390", "DEALER"), true);
  assert.equal(accessoryLineCounts("공격력", "+1.55%", "SUPPORT"), false);
  // Utility lines: neither role.
  for (const [name, value] of [["최대 생명력", "+6500"], ["파티원 보호막 효과", "+3.50%"], ["전투 중 생명력 회복량", "+50"]] as const) {
    assert.equal(accessoryLineCounts(name, value, "DEALER"), false, name);
    assert.equal(accessoryLineCounts(name, value, "SUPPORT"), false, name);
  }
  // No role, or a line not in the lists: undecided.
  assert.equal(accessoryLineCounts("추가 피해", "+2.60%", null), null);
  assert.equal(accessoryLineCounts("새 연마 효과", "+1.00%", "DEALER"), null);
});
