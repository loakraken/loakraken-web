import assert from "node:assert/strict";
import test from "node:test";
import { CUBE_DATA, checkCubeData, rewardText } from "../lib/tools/cube-rewards";

test("cube data is consistent", () => {
  assert.deepEqual(checkCubeData(CUBE_DATA), []);
});

test("only the 4th unlock carries values; the rest stay null with a reason (PM 총괄 10-12)", () => {
  const filled = CUBE_DATA.stages.filter((s) => s.rewards);
  assert.deepEqual(
    filled.map((s) => s.id),
    ["unlock-4"],
  );
  assert.equal(CUBE_DATA.boxProbability.values, null);
  const [unlock4] = filled;
  assert.equal(unlock4.entryLevel, 1720);
  assert.equal(unlock4.basis, "1배 입장 기준");
  assert.deepEqual(
    unlock4.rewards!.clear.map((r) => [r.item, r.count]),
    [
      ["보석", 11],
      ["영웅 카드 경험치 카드", 5],
      ["고급 카드 경험치 카드", 1],
      ["돌파석", 41],
      ["용암의 숨결", 8],
      ["빙하의 숨결", 8],
    ],
  );
  assert.equal(unlock4.rewards!.hiddenRooms.find((r) => r.room === "두키왕")!.rewards, null, "approximate value left out");
  assert.equal(unlock4.rewards!.megaLucky, null);
});

test("converted gem counts say what they were converted to", () => {
  const gem = CUBE_DATA.stages.at(-1)!.rewards!.clear[0];
  assert.equal(rewardText(gem), "보석 11개(2레벨 환산)");
});

test("the checker catches a value without its reason pair", () => {
  const broken = structuredClone(CUBE_DATA);
  broken.stages[0].reason = null;
  broken.stages.at(-1)!.rewards!.hiddenRooms[0].reason = null;
  const problems = checkCubeData(broken);
  assert.ok(problems.some((p) => p.includes("no rewards and no reason")));
  assert.ok(problems.some((p) => p.includes("rewards xor reason")));
});
