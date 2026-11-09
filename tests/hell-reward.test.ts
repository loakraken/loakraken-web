import assert from "node:assert/strict";
import test from "node:test";
import { HELL_DATA, checkHellData, stageReward } from "../lib/tools/hell-reward";

test("hell reward data: every kind and key level has stages 0-10, counts rise with the stage", () => {
  assert.deepEqual(checkHellData(HELL_DATA), []);
});

test("hell reward data: cells checked against a second source (key level 1, 4 at stage 0)", () => {
  // 22 cells matched one target site's drop table (레퍼런스 2026-11-09).
  assert.deepEqual(stageReward("hell", 1640, 0), {
    destruction: 1000,
    guardian: 3000,
    breakthrough: 45,
    fusion: 40,
    lava: 6,
    glacier: 18,
    boundGold: 3200,
    stoneKit: 4,
    bracelet: { grades: ["RELIC"], count: 1 },
    specialRefine: 40,
    destinyStone: 2,
    chaosStone: 7,
  });
  const top = stageReward("hell", 1750, 0)!;
  assert.equal(top.destruction, 600);
  assert.equal(top.guardian, 1800);
  assert.equal(top.boundGold, 5500);
  assert.deepEqual(top.gem, { grades: ["RARE"], count: 3 });
  assert.equal(stageReward("abyss", 1640, 0)!.boundGold, 16000);
  assert.equal(stageReward("hell", 1640, 11), null);
});

test("hell reward data: a lower stage paying more is caught", () => {
  const broken = structuredClone(HELL_DATA);
  broken.hell["1700"][3].reward.boundGold = 1;
  assert.ok(checkHellData(broken).some((p) => p.includes("hell 1700 3 boundGold")));
});
