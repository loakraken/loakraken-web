import assert from "node:assert/strict";
import test from "node:test";
import { HELL_DATA, MARKET_NAMES, checkHellData, gradeText, levelItems, stageReward, stageValue, unitKey } from "../lib/tools/hell-reward";

test("hell reward data: every kind and key level has stages 0-10, counts rise with the stage", () => {
  assert.deepEqual(checkHellData(HELL_DATA), []);
});

test("hell reward data: cells checked against a second source (key level 1, 4 at stage 0)", () => {
  // 22 cells matched a second source's drop table (레퍼런스 2026-11-09).
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
test("hell reward value: market lines, bound gold, manual values (0 unset), choose-one pairs count the higher half", () => {
  const reward = stageReward("hell", 1640, 0)!;
  const market = (name: string) => ({ "용암의 숨결": 300, "빙하의 숨결": 100 })[name] ?? null;
  const none = stageValue(reward, market, () => 0);
  // 용암 6 × 300 + 빙하 18 × 100, bound gold 3,200, every manual line 0.
  assert.equal(none.market, 6 * 300 + 18 * 100);
  assert.equal(none.boundGold, 3200);
  assert.equal(none.manual, 0);
  assert.equal(none.total, 3600 + 3200);
  // Manual values per unit; of 파괴석/수호석 the higher half counts, 수호석 here (3,000 × 2 > 1,000 × 5).
  const set: Record<string, number> = { destruction: 5, guardian: 2, "bracelet:RELIC": 900 };
  const v = stageValue(reward, market, (k) => set[k] ?? 0);
  assert.equal(v.lines.find((l) => l.key === "destruction")!.notChosen, true);
  assert.equal(v.lines.find((l) => l.key === "guardian")!.notChosen, false);
  assert.equal(v.manual, 3000 * 2 + 900);
  assert.equal(v.total, v.market + v.boundGold + v.manual);
  // No market price yet: the line is listed with a null unit and counts 0.
  const waiting = stageValue(reward, () => null, () => 0);
  assert.equal(waiting.lines.find((l) => l.key === "lava")!.unit, null);
  assert.equal(waiting.total, 3200);
});

test("hell reward value: graded items keep one value per grade", () => {
  const g = stageReward("hell", 1700, 5)!;
  assert.equal(g.gem && unitKey("gem", g.gem), "gem:RARE~EPIC:random");
  assert.equal(g.bracelet && unitKey("bracelet", g.bracelet), "bracelet:ANCIENT");
  assert.equal(g.gem && gradeText(g.gem), "희귀~영웅");
  // Only settled market items are ever priced: breaths everywhere, hell materials per key level.
  assert.deepEqual(MARKET_NAMES, [
    "용암의 숨결",
    "빙하의 숨결",
    "운명의 파괴석",
    "운명의 수호석",
    "운명의 돌파석",
    "아비도스 융화 재료",
    "순환 돌파석",
    "운명의 돌",
    "혼돈의 돌",
    "운명의 파괴석 결정",
    "운명의 수호석 결정",
    "위대한 운명의 돌파석",
    "상급 아비도스 융화 재료",
    "전이 돌파석",
  ]);
});
test("hell reward value: hell materials are priced as their settled market items; 1730 marked bound", () => {
  const prices: Record<string, number> = { "운명의 파괴석 결정": 10, "운명의 수호석 결정": 4, "위대한 운명의 돌파석": 50, "상급 아비도스 융화 재료": 90 };
  const v = stageValue(stageReward("hell", 1730, 0)!, (n) => prices[n] ?? null, () => 0, levelItems("hell", 1730));
  const line = (key: string) => v.lines.find((l) => l.key === key)!;
  assert.equal(line("destruction").label, "운명의 파괴석 결정");
  assert.equal(line("destruction").trade, "BOUND");
  // Shown bound only where an in-game text says so; the special-refine stone at 1730 is not.
  assert.equal(line("specialRefine").label, "전이 돌파석");
  assert.equal(line("specialRefine").trade, "UNCONFIRMED");
  assert.equal(line("lava").trade, "UNCONFIRMED");
  // 파괴석 결정 500 × 10 = 5,000 vs 수호석 결정 1,500 × 4 = 6,000: the 수호석 half counts.
  assert.equal(line("destruction").notChosen, true);
  assert.equal(v.market, 1500 * 4 + 25 * 50 + 60 * 90);
  // 1640: plain names, tradeable or not unconfirmed. 나락: names not settled, user values.
  const low = stageValue(stageReward("hell", 1640, 0)!, (n) => prices[n] ?? null, () => 0, levelItems("hell", 1640));
  assert.equal(low.lines.find((l) => l.key === "destruction")!.label, "운명의 파괴석");
  assert.equal(low.lines.find((l) => l.key === "destruction")!.trade, "UNCONFIRMED");
  assert.equal(levelItems("abyss", 1640), null);
  const abyss = stageValue(stageReward("abyss", 1640, 0)!, (n) => prices[n] ?? null, () => 0, levelItems("abyss", 1640));
  assert.equal(abyss.lines.find((l) => l.key === "destinyStone")!.pricing.kind, "MANUAL");
});