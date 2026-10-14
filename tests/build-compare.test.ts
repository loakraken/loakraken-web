import assert from "node:assert/strict";
import test from "node:test";
import { compareBuild, outsideSample } from "../lib/stats/build-compare";
import type { ClassBuildCells, ClassBuilds } from "../lib/stats/class-builds";

/** One character's cells as the backend gives them (synthetic values). */
function cells(overrides: Partial<ClassBuildCells> = {}): ClassBuildCells {
  const key = (name: string) => ({ name });
  return {
    classEngravings: key("버스트"),
    engravingCombos: { engravings: ["아드레날린", "예리한 둔기", "원한"] },
    engravings: ["아드레날린", "예리한 둔기", "원한"].map(key),
    arkPassivePoints: { evolution: { value: 140 }, enlightenment: { value: 101 }, leap: { value: 70 } },
    // Tier 4 only, higher levels first (the 멸화 is not here: the backend leaves it out).
    gems: { damage: [{ value: 10 }, { value: 8 }], cooldown: [{ value: 9 }] },
    cardSets: { set: "세상을 구하는 빛", pieces: 6, awakening: 30 },
    topStats: { name: "특화", tie: false },
    braceletEligible: true,
    braceletStats: ["특화", "치명"].map(key),
    ...overrides,
  };
}

const section = <T>(cells: T[], hidden = 0) => ({ known: 100, hidden: { count: hidden, share: hidden }, cells });
const builds = {
  braceletItemLevelMin: 1680,
  engravingCombos: section(
    [
      { engravings: ["아드레날린", "예리한 둔기", "원한"], count: 50, share: 50 },
      { engravings: ["돌격대장", "원한", "저주받은 인형"], count: 30, share: 30 },
      { engravings: ["기습의 대가", "원한", "질량 증가"], count: 10, share: 10 },
      { engravings: ["결투의 대가", "원한", "타격의 대가"], count: 6, share: 6 },
    ],
    4,
  ),
  engravings: section([
    { name: "원한", count: 96, share: 96 },
    { name: "아드레날린", count: 60, share: 60 },
    { name: "돌격대장", count: 35, share: 35 },
  ]),
  arkPassivePoints: {
    evolution: section([{ value: 140, count: 90, share: 90 }]),
    enlightenment: section([{ value: 100, count: 70, share: 70 }, { value: 101, count: 20, share: 20 }]),
    leap: section([{ value: 70, count: 95, share: 95 }]),
  },
  gems: {
    damage: section([{ value: 10, count: 300, share: 60 }, { value: 9, count: 200, share: 40 }]),
    cooldown: section([{ value: 10, count: 280, share: 56 }, { value: 9, count: 220, share: 44 }]),
  },
  cardSets: section([{ set: "세상을 구하는 빛", pieces: 6, awakening: 30, count: 80, share: 80 }]),
  topStats: { known: 100, ties: 0, hidden: { count: 0, share: 0 }, cells: [{ name: "특화", count: 70, share: 70 }, { name: "치명", count: 30, share: 30 }] },
  braceletStats: { known: 100, unread: 0, hidden: { count: 0, share: 0 }, cells: [{ name: "특화", count: 90, share: 90 }, { name: "치명", count: 60, share: 60 }, { name: "신속", count: 20, share: 20 }] },
} as unknown as ClassBuilds;

test("comparison: first three, the rest, and where mine stands in words", () => {
  const sections = Object.fromEntries(compareBuild(builds, cells()).map((s) => [s.id, s]));
  // One setting per character: mine is the first; the rest share 100 − the first three.
  assert.equal(sections.combo.verdict, "대세와 같아요");
  assert.equal(sections.combo.mine, "내 세팅: 아드레날린 · 예리한 둔기 · 원한");
  assert.deepEqual(sections.combo.top.map((row) => row.mine), [true, false, false]);
  assert.deepEqual(sections.combo.others, { cells: 1, share: 10, hiddenSmall: true });
  assert.equal(sections.combo.differs, false);
  // Second in the list: different from the most chosen, said in words.
  assert.equal(sections.enlightenment.verdict, "대세와 달라요 · 내 세팅은 2위");
  assert.equal(sections.enlightenment.mine, "내 세팅: 101");
  assert.equal(sections.enlightenment.differs, true);
  // Several per character: the most chosen is every line at least half have
  // (원한 96%·아드레날린 60%; 돌격대장 35% is not); mine beyond it is "추가", not different.
  assert.equal(sections.engravings.verdict, "대세와 같아요");
  assert.equal(sections.engravings.mine, "추가: 예리한 둔기");
  assert.equal(sections.engravings.differs, false);
  // Gems per effect kind, per gem.
  assert.equal(sections.damage.verdict, "가장 많은 10레벨이 있어요");
  assert.equal(sections.damage.mine, "내 보석: 10레벨 1개·8레벨 1개");
  assert.equal(sections.cooldown.verdict, "대세와 달라요 · 가장 많은 10레벨이 없음");
  assert.equal(sections.cooldown.differs, true);
  assert.equal(sections.cards.verdict, "대세와 같아요");
  assert.equal(sections.cards.mine, "내 세팅: 세상을 구하는 빛 6세트 30각성");
  assert.equal(sections.topStat.mine, "내 세팅: 특화");
  // 특화 90%·치명 60% are the most chosen; 신속 20% is not, and lacking it is not different.
  assert.equal(sections.bracelet.verdict, "대세와 같아요");
  assert.equal(sections.bracelet.mine, null);
});

test("comparison: the combo matches whatever order the names come in; a tie says how it was counted", () => {
  const sections = Object.fromEntries(
    compareBuild(builds, cells({ engravingCombos: { engravings: ["원한", "아드레날린", "예리한 둔기"] }, topStats: { name: "치명", tie: true } })).map((s) => [s.id, s]),
  );
  assert.equal(sections.combo.verdict, "대세와 같아요");
  assert.equal(sections.topStat.verdict, "대세와 달라요 · 내 세팅은 2위");
  assert.equal(sections.topStat.mine, "내 세팅: 치명 (같은 값이 있어 앞 순서로 셈)");
});

test("comparison, several per character: a missing majority line differs; no majority, no verdict", () => {
  const mine = cells({ braceletStats: [{ name: "치명" }, { name: "신속" }] });
  const lacking = compareBuild(builds, mine).find((s) => s.id === "bracelet")!;
  assert.equal(lacking.verdict, "대세와 달라요 · 과반이 쓰는 특화 없음");
  assert.equal(lacking.mine, "추가: 신속");
  assert.equal(lacking.differs, true);

  // No line reaching half: never call the first one the most chosen.
  const spread = {
    ...builds,
    braceletStats: { known: 100, unread: 0, hidden: { count: 0, share: 0 }, cells: [{ name: "특화", count: 45, share: 45 }, { name: "치명", count: 40, share: 40 }] },
  } as unknown as ClassBuilds;
  const none = compareBuild(spread, mine).find((s) => s.id === "bracelet")!;
  assert.equal(none.verdict, "뚜렷한 대세 없음");
  assert.equal(none.differs, false);
  assert.equal(none.mine, "내 세팅: 치명·신속");
});

test("comparison: what the backend could not read compares nothing and says so", () => {
  const unread = cells({
    engravingCombos: null,
    engravings: null,
    arkPassivePoints: { evolution: null, enlightenment: null, leap: null },
    gems: { damage: null, cooldown: null },
    cardSets: null,
    topStats: null,
    braceletStats: null,
  });
  for (const mine of [unread, null])
    for (const section of compareBuild(builds, mine)) {
      assert.equal(section.differs, false, section.id);
      assert.equal(section.mine, null, section.id);
      assert.match(section.verdict, /읽지 못해 비교하지 않았어요/, section.id);
    }
  // No gem of that effect kind is not unread: it is said as none.
  const noCooldown = compareBuild(builds, cells({ gems: { damage: [{ value: 10 }], cooldown: [] } })).find((s) => s.id === "cooldown")!;
  assert.equal(noCooldown.verdict, "대세와 달라요 · 가장 많은 10레벨이 없음");
  assert.equal(noCooldown.mine, "내 보석: 이 효과의 4티어 보석 없음");
});

test("comparison: under the bracelet item level the bracelet is not compared, as it is not counted", () => {
  const low = compareBuild(builds, cells({ braceletEligible: false, braceletStats: null }), 1680).find((s) => s.id === "bracelet")!;
  assert.equal(low.verdict, "아이템 레벨 1,680 미만이라 비교하지 않았어요");
  assert.equal(low.differs, false);
  assert.equal(low.mine, null);
});

test("outside the sample: each reason in words, other class left to the caller, unknown ones as the conditions", () => {
  const conditions = { itemLevelMin: 1680, itemLevelMax: null, activeDays: 30, braceletItemLevelMin: 1680 };
  assert.equal(outsideSample({ inSample: true, reasons: [], conditions, itemLevel: 1700 }), null);
  assert.equal(
    outsideSample({ inSample: false, reasons: ["ITEM_LEVEL_OUT_OF_RANGE", "NOT_RECENT", "NO_COMBAT_POWER"], conditions, itemLevel: 1660 }),
    "이 캐릭터는 표본에 들지 않아요(아이템 레벨 1,680 미만 · 최근 30일 안에 확인되지 않음 · 전투력 확인 없음).",
  );
  assert.equal(
    outsideSample({ inSample: false, reasons: ["ITEM_LEVEL_OUT_OF_RANGE"], conditions: { ...conditions, itemLevelMax: 1700 }, itemLevel: 1720.5 }),
    "이 캐릭터는 표본에 들지 않아요(아이템 레벨 1,700 초과).",
  );
  assert.equal(outsideSample({ inSample: false, reasons: ["OTHER_CLASS"], conditions, itemLevel: 1700 }), null);
  assert.equal(
    outsideSample({ inSample: false, reasons: ["SOMETHING_NEW", "ANOTHER_NEW"], conditions, itemLevel: 1700 }),
    "이 캐릭터는 표본에 들지 않아요(통계 조건 밖).",
  );
});
