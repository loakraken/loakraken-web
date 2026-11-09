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

test("hell reward data: rules that hold on every row (계산 검증 2026-11-09)", () => {
  for (const kind of ["hell", "abyss"] as const)
    for (const level of HELL_DATA.keyLevels)
      for (const { stage, reward } of HELL_DATA[kind][String(level)]) {
        const at = `${kind} ${level} ${stage}`;
        if (reward.destruction !== undefined) assert.equal(reward.guardian, reward.destruction * 3, `${at} 수호석 = 3 × 파괴석`);
        if (reward.lava !== undefined) assert.equal(reward.glacier, reward.lava * 3, `${at} 빙하 = 3 × 용암`);
      }
  // 나락 pays five times 지옥 on every cell both have (count only; the grade is the same).
  let shared = 0;
  for (const level of HELL_DATA.keyLevels)
    for (const { stage, reward } of HELL_DATA.hell[String(level)]) {
      const abyss = stageReward("abyss", level, stage)!;
      for (const [key, value] of Object.entries(reward)) {
        const other = abyss[key as keyof typeof abyss];
        if (other === undefined) continue;
        const n = typeof value === "number" ? value : value.count;
        const m = typeof other === "number" ? other : other.count;
        assert.equal(m, n * 5, `abyss ${level} ${stage} ${key} = 5 × hell`);
        shared += 1;
      }
    }
  // 253 table cells; each of the two A/B pair cells per stage counts twice here (+88).
  assert.equal(shared, 253 + 88);
});