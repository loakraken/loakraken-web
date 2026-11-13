import assert from "node:assert/strict";
import test from "node:test";
import { HELL_DATA, MARKET_NAMES, STALE_PRICE_MINUTES, baseValue, checkHellData, gradeText, heldView, levelItems, priceAge, rankBoxes, stageBase, stageReward, stageValue, unitKey, zeroManualCount } from "../lib/tools/hell-reward";

// codex QA v0.3.11 P2: the price time is shown, the oldest price decides, an hour old is named old (KST).
test("hell reward price time: oldest price, minutes, old past an hour", () => {
  const now = Date.parse("2026-11-12T05:00:00Z"); // 14:00 KST
  assert.equal(priceAge(now, []), null);
  assert.deepEqual(priceAge(now, ["2026-11-12T04:59:40Z"]), { text: "시세 방금 수집", stale: false });
  assert.deepEqual(priceAge(now, ["2026-11-12T04:58:00Z", "2026-11-12T04:57:00Z"]), { text: "시세 3분 전 수집", stale: false });
  assert.equal(priceAge(now, [new Date(now - (STALE_PRICE_MINUTES - 1) * 60_000).toISOString()])!.stale, false);
  // 2 days 23 hours 40 minutes reads 3일 (nearest), as does 3 days less a minute (the minute clock).
  assert.deepEqual(priceAge(now, ["2026-11-12T04:59:00Z", "2026-11-09T05:20:00Z"]), { text: "오래된 시세 · 3일 전(11월 9일 14:20)", stale: true, short: "3일 전 시세" });
  assert.equal(priceAge(now, [new Date(now - (3 * 24 * 60 - 1) * 60_000).toISOString()])!.text.startsWith("오래된 시세 · 3일 전"), true);
  assert.equal(priceAge(now, [new Date(now - STALE_PRICE_MINUTES * 60_000).toISOString()])!.text, "오래된 시세 · 1시간 전(11월 12일 13:00)");
  // KST date across midnight UTC; under a day reads in hours (13 h 55 m → 14).
  assert.equal(priceAge(now, ["2026-11-11T15:05:00Z"])!.text, "오래된 시세 · 14시간 전(11월 12일 00:05)");
  assert.equal(priceAge(now, ["2026-11-11T15:05:00Z"])!.short, "14시간 전 시세");
  assert.equal(priceAge(now, ["2026-11-12T04:58:00Z"])!.short, undefined);
});

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
  const set: Record<string, number> = { "unsettled::destruction": 5, "unsettled::guardian": 2, "item:팔찌 상자:RELIC": 900 };
  const v = stageValue(reward, market, (k) => set[k] ?? 0);
  assert.equal(v.lines.find((l) => l.key === "destruction")!.notChosen, true);
  assert.equal(v.lines.find((l) => l.key === "guardian")!.notChosen, false);
  assert.equal(v.manual, 3000 * 2 + 900);
  assert.equal(v.total, v.market + v.boundGold + v.manual);
  // Prices not back yet: the market line is listed with a null unit and counts 0.
  const waiting = stageValue(reward, () => null, () => 0, null, false);
  assert.equal(waiting.lines.find((l) => l.key === "lava")!.unit, null);
  assert.equal(waiting.lines.find((l) => l.key === "lava")!.unpriced, false);
  assert.equal(waiting.total, 3200);
  // Prices back but this one has none (계산 검증 #1525 P1): it takes the user's value like a manual line.
  const none2 = stageValue(reward, (n) => (n === "빙하의 숨결" ? 100 : null), (k) => (k === "item:용암의 숨결" ? 50 : 0), null, true);
  const lava = none2.lines.find((l) => l.key === "lava")!;
  assert.equal(lava.unpriced, true);
  assert.equal(lava.unit, 50);
  assert.equal(none2.manual, 6 * 50);
  assert.equal(none2.market, 18 * 100);
});

test("hell reward value: graded items keep one value per grade", () => {
  const g = stageReward("hell", 1700, 5)!;
  assert.equal(g.gem && unitKey("젬", g.gem), "item:젬:RARE~EPIC:random");
  assert.equal(g.bracelet && unitKey("팔찌 상자", g.bracelet), "item:팔찌 상자:ANCIENT");
  assert.equal(g.gem && gradeText(g.gem), "희귀~영웅");
  // Only settled market items are ever priced: breaths everywhere, hell materials per key level.
  assert.deepEqual(MARKET_NAMES.slice(0, 14), [
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
// PM 총괄 #1525 P3: a value the user sets belongs to the item, not the row. A column that is
// another item at another key level does not take it.
test("hell reward value: user values follow the item name, never the row position", () => {
  const typed = new Map<string, number>();
  const value = (kind: "hell" | "abyss", level: number) =>
    stageValue(stageReward(kind, level, 0)!, () => null, (k) => typed.get(k) ?? 0, levelItems(kind, level), true, `${kind}:${level}`);
  const line = (v: ReturnType<typeof value>, key: string) => v.lines.find((l) => l.key === key)!;
  // 1640: the special-refine stone is 순환 돌파석 (no price on this stub, so the user's value).
  const low = value("hell", 1640);
  typed.set(line(low, "specialRefine").unitKey, 100);
  assert.equal(value("hell", 1640).lines.find((l) => l.key === "specialRefine")!.value, 40 * 100);
  // 1700 has the same item: the value applies there too.
  assert.equal(line(value("hell", 1700), "specialRefine").unit, 100);
  // 1750's column is 전이 돌파석, another item: the value does not apply.
  const high = value("hell", 1750);
  assert.equal(line(high, "specialRefine").label, "전이 돌파석");
  assert.equal(line(high, "specialRefine").unit, 0);
  // Two levels, two values, two totals: 전이 돌파석 200 at 1750 leaves 1640's 순환 at 100.
  const before1640 = value("hell", 1640).total;
  const before1750 = high.total;
  typed.set(line(high, "specialRefine").unitKey, 200);
  assert.equal(value("hell", 1750).total, before1750 + 28 * 200);
  assert.equal(value("hell", 1640).total, before1640);
  assert.equal(line(value("hell", 1640), "specialRefine").value, 40 * 100);
  assert.equal(line(value("hell", 1750), "specialRefine").value, 28 * 200);
  // 나락's 운명의 돌 is not a settled item: its value stays there, not on 지옥's 운명의 돌.
  const abyss = value("abyss", 1750);
  typed.set(line(abyss, "destinyStone").unitKey, 7);
  assert.equal(line(value("abyss", 1750), "destinyStone").unit, 7);
  assert.equal(line(value("hell", 1750), "destinyStone").unit, 0);
  // A graded item keeps its value across kinds (same item and grade).
  typed.set(line(high, "bracelet").unitKey, 900);
  assert.equal(line(value("abyss", 1750), "bracelet").unit, 900);
});
// PM 총괄 11-10: one key opens ONE box; each box = its own items + the base every box gives.
test("hell reward boxes: each column is a box, ranked by its own value + the base, best first", () => {
  const prices: Record<string, number> = {
    "운명의 파괴석 결정": 10,
    "운명의 수호석 결정": 4,
    "위대한 운명의 돌파석": 50,
    "상급 아비도스 융화 재료": 90,
    "용암의 숨결": 300,
    "빙하의 숨결": 100,
  };
  const market = (n: string) => prices[n] ?? null;
  const stage = stageValue(stageReward("hell", 1750, 0)!, market, () => 0, levelItems("hell", 1750), true, "hell:1750");
  const boxes = rankBoxes(stage, null);
  // 지옥 1750 · 0: 11 columns but no 천상 도전권 at stage 0 → 10 boxes.
  assert.equal(boxes.length, 10);
  const byId = Object.fromEntries(boxes.map((b) => [b.id, b.value]));
  // A choose-one box counts its higher half: 수호석 결정 1,800 × 4 = 7,200 > 파괴석 결정 600 × 10.
  assert.equal(byId.stone, 1800 * 4);
  assert.equal(byId.fusion, 75 * 90);
  assert.equal(byId.breath, 12 * 300 + 36 * 100);
  assert.equal(byId.gold, 5500);
  assert.equal(byId.breakthrough, 30 * 50);
  // Ranked best first; the headline is one box, never the sum of all boxes.
  assert.deepEqual(boxes.map((b) => b.value), [...boxes.map((b) => b.value)].sort((a, b) => b - a));
  assert.ok(boxes[0].value < stage.total);
  // stone (7,200) ties breath (7,200): a tie keeps the table order, so stone is first.
  assert.equal(boxes[0].id, "stone");
  assert.equal(boxes[1].id, "breath");
});

test("hell reward boxes: the base is added to every box once; 풍요 multiplies only the base by 10", () => {
  const prices: Record<string, number> = { "운명의 파편": 0.1, "운명의 파괴석": 5, "운명의 수호석": 2, "운명의 돌파석": 20, "빙하의 숨결": 100 };
  const market = (n: string) => prices[n] ?? null;
  const items = [
    { label: "운명의 파편", qty: 3250, market: "운명의 파편" },
    { label: "운명의 파괴석", qty: 55, market: "운명의 파괴석" },
    { label: "운명의 수호석", qty: 375, market: "운명의 수호석" },
    { label: "운명의 돌파석", qty: 5, market: "운명의 돌파석" },
  ];
  const plain = baseValue(items, market, false);
  assert.equal(plain.value, 3250 * 0.1 + 55 * 5 + 375 * 2 + 5 * 20);
  const rich = baseValue(items, market, true);
  assert.equal(rich.value, plain.value * 10);
  const stage = stageValue(stageReward("hell", 1640, 0)!, market, () => 0, levelItems("hell", 1640), true, "hell:1640");
  const without = rankBoxes(stage, null);
  const withBase = rankBoxes(stage, rich);
  // Each box gains exactly the base (×10 here), its own items unchanged.
  for (const box of withBase) {
    const same = without.find((b) => b.id === box.id)!;
    assert.equal(box.contents, same.contents);
    assert.equal(box.value, same.contents + rich.value);
  }
});
test("hell reward base: 지옥 only, per level and stage, cells checked against a second source", () => {
  assert.deepEqual(checkHellData(HELL_DATA), []);
  const qty = (level: number, stage: number) => stageBase("hell", level, stage)!.map((i) => i.qty);
  // Cross-checked cells (레퍼런스 2026-11-10): stage 0 and 10 for 1640 / 1700, stage 0 for 1730 / 1750.
  assert.deepEqual(qty(1640, 0), [3250, 55, 375, 5]);
  assert.deepEqual(qty(1640, 10), [11250, 195, 1375, 30]);
  assert.deepEqual(qty(1700, 0), [4500, 100, 625, 13]);
  assert.deepEqual(qty(1700, 10), [15000, 350, 2250, 40]);
  assert.deepEqual(qty(1730, 0), [5200, 26, 170, 4]);
  // An in-game reward log: 1730 stage 9.
  assert.deepEqual(qty(1730, 9), [17000, 100, 620, 13]);
  // 1750 gives the same base as 1730; 1730+ items are the 결정 / 위대한 ones.
  assert.deepEqual(qty(1750, 7), qty(1730, 7));
  assert.deepEqual(stageBase("hell", 1750, 0)!.map((i) => i.market), ["운명의 파편", "운명의 파괴석 결정", "운명의 수호석 결정", "위대한 운명의 돌파석"]);
  assert.equal(stageBase("hell", 1640, 0)![1].market, "운명의 파괴석");
  // 나락 boxes have no base.
  assert.equal(stageBase("abyss", 1640, 0), null);
  assert.ok(MARKET_NAMES.includes("운명의 파편"));
});
// PM 총괄 11-10: the list order is held while only prices change, but the headline is never an old box.
test("hell reward boxes: a held order keeps the list, the best box always follows the values now", () => {
  const at = (prices: Record<string, number>) =>
    rankBoxes(stageValue(stageReward("hell", 1750, 0)!, (n) => prices[n] ?? null, () => 0, levelItems("hell", 1750), true, "hell:1750"), null);
  // First prices: 융화 (75 × 271) leads.
  const first = at({ "상급 아비도스 융화 재료": 271, "빙하의 숨결": 430 });
  assert.equal(first[0].id, "fusion");
  const held = first.map((b) => b.id);
  // New prices: 빙하 jumps, 재련 보조 is now the best box.
  const now = at({ "상급 아비도스 융화 재료": 271, "빙하의 숨결": 1000 });
  assert.equal(now[0].id, "breath");
  const view = heldView(now, held);
  assert.deepEqual(view.list.map((b) => b.id), held);
  assert.equal(view.best!.id, "breath");
  assert.equal(view.best!.value, 36 * 1000);
  assert.equal(view.stale, true);
  // Re-sorted (the user's re-sort): the list follows the values now and is not stale.
  assert.equal(heldView(now, now.map((b) => b.id)).stale, false);
  // codex #1536: a swap lower down (ranks 2 and 3) with the top unchanged is stale too.
  assert.deepEqual(held.slice(0, 3), ["fusion", "breath", "gold"]);
  const lower = at({ "상급 아비도스 융화 재료": 271, "빙하의 숨결": 100 });
  assert.deepEqual(lower.slice(0, 3).map((b) => b.id), ["fusion", "gold", "breath"]);
  const lowerView = heldView(lower, held);
  assert.equal(lowerView.list[0].id, lowerView.best!.id);
  assert.equal(lowerView.stale, true);
  // Equal values in the held order are not stale.
  assert.equal(heldView(first, held).stale, false);
});
// 계산 검증 #1536: an unpriced item that is both a box line and a base line is one item in the 0G count.
test("hell reward: the 0G count counts each item once", () => {
  const none = () => null;
  const value = stageValue(stageReward("hell", 1750, 0)!, none, () => 0, levelItems("hell", 1750), true, "hell:1750");
  const base = baseValue(stageBase("hell", 1750, 0)!, none, false, () => 0, true);
  const shared = base.lines.filter((b) => value.lines.some((l) => !l.notChosen && l.unitKey === b.unitKey));
  assert.ok(shared.length > 0, "some base item is also a counted box line");
  const keys = new Set([
    ...value.lines.filter((l) => !l.notChosen && (l.pricing.kind === "MANUAL" || l.unpriced) && !(l.unit ?? 0)).map((l) => l.unitKey),
    ...base.lines.filter((l) => l.unpriced).map((l) => l.unitKey),
  ]);
  assert.equal(zeroManualCount(value, base), keys.size);
  assert.ok(zeroManualCount(value, base) < value.lines.filter((l) => !l.notChosen && (l.pricing.kind === "MANUAL" || l.unpriced)).length + base.lines.length);
});
// 계산 검증 #1530: an unpriced base item takes the user's value, like a box item (never a silent 0).
test("hell reward base: an item without a price takes the user's value once prices are back", () => {
  const items = stageBase("hell", 1750, 0)!;
  const prices: Record<string, number> = { "운명의 파괴석 결정": 9, "운명의 수호석 결정": 1.9, "위대한 운명의 돌파석": 33 };
  const typed: Record<string, number> = { "item:운명의 파편": 0.1 };
  // Prices not back yet: no price, not unpriced, counts 0.
  const waiting = baseValue(items, () => null, false, (k) => typed[k] ?? 0, false);
  assert.equal(waiting.lines[0].unit, null);
  assert.equal(waiting.lines[0].unpriced, false);
  // Back, 운명의 파편 has none: the user's value per fragment (5,200 × 0.1).
  const back = baseValue(items, (n) => prices[n] ?? null, false, (k) => typed[k] ?? 0, true);
  const shards = back.lines.find((l) => l.label === "운명의 파편")!;
  assert.equal(shards.unpriced, true);
  assert.equal(shards.unitKey, "item:운명의 파편");
  assert.equal(shards.value, 5200 * 0.1);
  assert.equal(back.value, 5200 * 0.1 + 26 * 9 + 170 * 1.9 + 4 * 33);
  // 풍요 multiplies the quantity, the typed unit value stays per fragment.
  assert.equal(baseValue(items, (n) => prices[n] ?? null, true, (k) => typed[k] ?? 0, true).lines[0].value, 52000 * 0.1);
  // A base item that is also a box item shares the user's value (one key per item name).
  const box = stageValue(stageReward("hell", 1750, 0)!, () => null, () => 0, levelItems("hell", 1750), true, "hell:1750");
  const stoneLine = box.lines.find((l) => l.key === "destruction")!;
  assert.equal(stoneLine.unitKey, back.lines.find((l) => l.label === "운명의 파괴석 결정")!.unitKey);
});