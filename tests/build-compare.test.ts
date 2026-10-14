import assert from "node:assert/strict";
import test from "node:test";
import { compareBuild, myBuild } from "../lib/stats/build-compare";
import type { Character } from "../lib/character/model";
import type { ClassBuilds } from "../lib/stats/class-builds";

/** A character with only what the comparison reads (synthetic values). */
function character(overrides: Record<string, unknown> = {}): Character {
  const stat = (type: string, value: string) => ({ type, value, tooltip: [] });
  return {
    stats: [stat("치명", "612"), stat("특화", "1,812"), stat("신속", "88"), stat("제압", "71"), stat("인내", "70"), stat("숙련", "69")],
    loadout: {
      engravings: {
        slots: [],
        effects: [],
        arkPassiveEffects: [
          { name: "원한", grade: "유물", level: 4, abilityStoneLevel: 2, description: null },
          { name: "아드레날린", grade: "유물", level: 4, abilityStoneLevel: 0, description: null },
          { name: " ", grade: null, level: null, abilityStoneLevel: null, description: null },
          { name: "예리한 둔기", grade: "유물", level: 4, abilityStoneLevel: null, description: null },
        ],
      },
      arkPassive: {
        title: "버스트",
        enabled: true,
        points: [
          { name: "진화", value: 140, description: null },
          { name: "깨달음", value: 101, description: null },
          { name: "도약", value: 70, description: null },
        ],
        effects: [],
      },
      gems: {
        items: [
          { slot: 2, name: "10레벨 겁화의 보석", level: 10, icon: null, grade: null, titleLine: null, itemLevel: null, tier: 4, tradeLines: [] },
          { slot: 1, name: "9레벨 작열의 보석", level: 9, icon: null, grade: null, titleLine: null, itemLevel: null, tier: 4, tradeLines: [] },
          { slot: 3, name: "10레벨 멸화의 보석", level: 10, icon: null, grade: null, titleLine: null, itemLevel: null, tier: 3, tradeLines: [] },
          { slot: 4, name: "8레벨 광휘의 보석", level: 8, icon: null, grade: null, titleLine: null, itemLevel: null, tier: 4, tradeLines: [] },
        ],
        effects: {
          description: null,
          skills: [
            { gemSlot: 1, name: "a", description: ["재사용 대기시간 20.00% 감소"], option: null, icon: null },
            { gemSlot: 2, name: "b", description: ["피해 40.00% 증가"], option: null, icon: null },
            { gemSlot: 3, name: "c", description: ["피해 30.00% 증가"], option: null, icon: null },
            { gemSlot: 4, name: "d", description: ["피해 24.00% 증가"], option: null, icon: null },
          ],
        },
      },
      cards: {
        items: [],
        effects: [
          {
            index: 0,
            cardSlots: [],
            items: [
              { name: "세상을 구하는 빛 2세트", description: "암속성 피해 감소" },
              { name: "세상을 구하는 빛 6세트", description: null },
              { name: "세상을 구하는 빛 6세트 (18각성합계)", description: null },
              { name: "세상을 구하는 빛 6세트 (30각성합계)", description: null },
            ],
          },
        ],
      },
      equipment: [
        {
          type: "팔찌",
          name: "팔찌",
          icon: null,
          grade: null,
          detail: { braceletEffects: [{ text: "특화 +100\n치명타 피해 +8.40%", grade: null }, { text: "치명 +81", grade: null }] },
        },
      ],
      arkGrid: null,
      skills: [],
    },
    ...overrides,
  } as unknown as Character;
}

test("my build: read with the class statistics' own rules", () => {
  const mine = myBuild(character());
  assert.equal(mine.classEngraving, "버스트");
  // Names sorted as the statistics sort them, blanks left out.
  assert.deepEqual(mine.combo, ["아드레날린", "예리한 둔기", "원한"]);
  assert.deepEqual(mine.points, { evolution: 140, enlightenment: 101, leap: 70 });
  // In slot order; the kind from the name, the effect kind from that slot's skill line.
  assert.deepEqual(mine.gems, [
    { kind: "작열", level: 9, mode: "COOLDOWN" },
    { kind: "겁화", level: 10, mode: "DAMAGE" },
    { kind: "멸화", level: 10, mode: "DAMAGE" },
    { kind: "광휘", level: 8, mode: "DAMAGE" },
  ]);
  // The largest set; at the same size, the highest awakening total.
  assert.deepEqual(mine.cardSet, { set: "세상을 구하는 빛", pieces: 6, awakening: 30 });
  // "1,812" reads 1812: 특화 is the top stat.
  assert.equal(mine.topStat, "특화");
  // Only "stat +n" lines count.
  assert.deepEqual(mine.braceletStats, ["특화", "치명"]);
});

test("my build: ties go to the earlier stat, an unread stat or part gives nothing", () => {
  const tie = character({
    stats: ["치명", "특화", "신속", "제압", "인내", "숙련"].map((type, i) => ({ type, value: i < 2 ? "900" : "60", tooltip: [] })),
  });
  assert.equal(myBuild(tie).topStat, "치명");
  const missing = character({ stats: [{ type: "치명", value: "900", tooltip: [] }] });
  assert.equal(myBuild(missing).topStat, null);
  const bare = character();
  (bare.loadout as unknown as Record<string, unknown>).engravings = null;
  (bare.loadout as unknown as Record<string, unknown>).equipment = [];
  assert.equal(myBuild(bare).combo, null);
  assert.equal(myBuild(bare).braceletStats, null);
});

const section = <T>(cells: T[], hidden = 0) => ({ known: 100, hidden: { count: hidden, share: hidden }, cells });
const builds = {
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
  const sections = Object.fromEntries(compareBuild(builds, myBuild(character())).map((s) => [s.id, s]));
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
  // Gems per effect kind, tier 4 only (the 멸화 is left out).
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

test("comparison, several per character: a missing majority line differs; no majority, no verdict", () => {
  const onlyCrit = { ...character(), stats: character().stats } as Character;
  const bracelet = (onlyCrit.loadout.equipment[0] as unknown as { detail: { braceletEffects: { text: string; grade: null }[] } }).detail;
  bracelet.braceletEffects = [{ text: "치명 +100", grade: null }, { text: "신속 +81", grade: null }];
  const mine = myBuild(onlyCrit);
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

test("comparison: an unread character compares nothing and says so", () => {
  const empty = { classEngraving: null, combo: null, points: null, gems: null, cardSet: null, topStat: null, braceletStats: null };
  for (const section of compareBuild(builds, empty)) {
    assert.equal(section.differs, false, section.id);
    assert.equal(section.mine, null, section.id);
    assert.match(section.verdict, /읽지 못해 비교하지 않았어요/, section.id);
  }
});
