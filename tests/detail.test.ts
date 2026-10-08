import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  activeSkills,
  engravingBookString,
  groupEquipment,
  parsePassiveNode,
  positionOf,
  qualityTier,
  refreshWindow,
  relativeAgo,
  remainingLabel,
  skillSummary,
  stoneBonus,
  type Skill,
} from "../lib/character/detail";
import type { Character } from "../lib/character/model";

const base = (): Character =>
  JSON.parse(
    readFileSync(
      new URL("./fixtures/character-full-data.json", import.meta.url),
      "utf8",
    ),
  );
test("position matches backend position-v1: class first, then enlightenment node of any tier", () => {
  const as = (className: string, ...descriptions: string[]) => {
    const data = base();
    data.className = className;
    data.loadout.arkPassive!.effects = descriptions.map((description) => ({
      name: "깨달음",
      description,
      icon: null,
      effect: null,
    }));
    return data;
  };
  assert.equal(
    positionOf(as("블래스터", "깨달음 1티어 포격 강화 Lv.1")),
    "DEALER",
    "non-support class",
  );
  assert.equal(
    positionOf(
      as(
        "바드",
        "깨달음 1티어 완벽한 화음 Lv.3",
        "<FONT color='#83E9FF'>깨달음</FONT> 2티어 <FONT>절실한 구원 Lv.3</FONT>",
      ),
    ),
    "SUPPORT",
    "2nd-tier support node",
  );
  assert.equal(
    positionOf(
      as(
        "홀리나이트",
        "깨달음 1티어 신성 보호 Lv.3",
        "깨달음 2티어 축복의 오라 Lv.3",
      ),
    ),
    "SUPPORT",
  );
  assert.equal(positionOf(as("발키리", "깨달음 1티어 해방자 Lv.3")), "SUPPORT");
  assert.equal(
    positionOf(as("바드", "깨달음 1티어 진실된 용맹 Lv.3")),
    "DEALER",
  );
  assert.equal(
    positionOf(as("도화가", "진화 1티어 치명 Lv.10")),
    null,
    "support class without a deciding node",
  );
  const backend = as("바드");
  (backend.analysis as Record<string, unknown>).position = "SUPPORT";
  assert.equal(positionOf(backend), "SUPPORT", "backend value wins");
});

test("refresh window uses refreshAvailableAt, else fetchedAt + 5 minutes", () => {
  const fetchedAt = "2026-10-05T03:00:00Z";
  const now = Date.parse("2026-10-05T03:02:00Z");
  const declared = refreshWindow(
    { fetchedAt, refreshAvailableAt: "2026-10-05T03:06:00Z" },
    now,
  );
  assert.equal(declared.remainingMs, 4 * 60_000);
  assert.equal(declared.estimated, false);
  const estimated = refreshWindow({ fetchedAt, refreshAvailableAt: null }, now);
  assert.equal(estimated.remainingMs, 3 * 60_000);
  assert.equal(estimated.estimated, true);
  assert.equal(refreshWindow({ fetchedAt }, now + 10 * 60_000).remainingMs, 0);
  assert.equal(relativeAgo(2 * 60_000 + 5), "2분 전");
  assert.equal(relativeAgo(10_000), "방금");
  assert.equal(remainingLabel(125_000), "2분 05초");
});

test("only invested skills count for part break and counter (backend guidance)", () => {
  const skill = (over: Partial<Skill>): Skill => ({
    name: "s",
    icon: null,
    level: 1,
    type: "일반",
    partBreakLevel: null,
    counter: false,
    tripods: [],
    rune: null,
    gemEffects: [],
    ...over,
  });
  const skills = [
    skill({ name: "기본", partBreakLevel: 1, counter: true }),
    skill({ name: "사용", level: 14, partBreakLevel: 1 }),
    skill({ name: "카운터", level: 10, counter: true }),
    skill({
      name: "트포",
      tripods: [{ tier: 0, slot: 1, name: "t", icon: null }],
    }),
  ];
  assert.deepEqual(
    activeSkills(skills).map((item) => item.name),
    ["사용", "카운터", "트포"],
  );
  const summary = skillSummary(skills);
  assert.equal(summary.partBreakCount, 1);
  assert.equal(summary.partBreakLevel, 1);
  assert.equal(summary.counterCount, 1);
});

test("equipment groups follow the in-game slot order", () => {
  const item = (type: string) => ({
    type,
    name: type,
    icon: null,
    grade: null,
    detail: null,
  });
  const groups = groupEquipment(
    ["무기", "반지", "투구", "팔찌", "어빌리티 스톤", "목걸이", "나침반"].map(
      item,
    ),
  );
  assert.deepEqual(
    groups.armor.map((e) => e.type),
    ["투구", "무기"],
  );
  assert.deepEqual(
    groups.accessories.map((e) => e.type),
    ["목걸이", "반지"],
  );
  assert.equal(groups.stone?.type, "어빌리티 스톤");
  assert.equal(groups.bracelet?.type, "팔찌");
  assert.deepEqual(
    groups.others.map((e) => e.type),
    ["나침반"],
  );
});

test("passive nodes, quality tiers and engraving book string", () => {
  assert.deepEqual(
    parsePassiveNode("<FONT>깨달음</FONT> 2티어 <FONT>포격 충전 Lv.3</FONT>"),
    { tree: "깨달음", tier: 2, node: "포격 충전", level: 3 },
  );
  assert.equal(parsePassiveNode("설명만 있음").tree, null);
  assert.equal(qualityTier(100), "max");
  assert.equal(qualityTier(91), "high");
  // Six bands like the game and the other armory sites: 100/90/70/30/10/0.
  assert.deepEqual(
    [100, 95, 75, 45, 15, 5, 0].map(qualityTier),
    ["max", "high", "good", "normal", "low", "poor", "poor"],
  );
  assert.equal(qualityTier(null), "none");
  assert.equal(
    engravingBookString([{ level: 4 }, { level: 4 }, { level: 3 }]),
    "443",
  );
  assert.equal(engravingBookString([{ level: null }]), null);
});

test("avatars group by slot (overlay shares the base slot) and effect lines sum by stat", async () => {
  const { avatarEffectTotals, avatarSlot } = await import("../lib/character/inner");
  const avatar = (type: string | null, effects: string[] = [], isInner = false) => ({
    type, name: "a", icon: null, grade: "전설", isSet: false, isInner, effects,
  });
  assert.equal(avatarSlot(avatar("무기 아바타")), "무기");
  assert.equal(avatarSlot(avatar("무기 덧입기 아바타", [], true)), "무기");
  assert.equal(avatarSlot(avatar("이동 효과")), "이동 효과");
  assert.equal(avatarSlot(avatar(null)), "기타");
  assert.deepEqual(
    avatarEffectTotals([
      avatar("상의 아바타", ["민첩 +2.00%"]),
      avatar("하의 아바타", ["민첩 +1.00%", "특수 효과 설명"]),
      avatar("머리 아바타", ["힘 +1.50%"]),
    ]),
    [
      { name: "민첩", value: 3 },
      { name: "힘", value: 1.5 },
    ],
  );
});

test("gem kind follows the gem name and the base attack bonus is read from the set text", async () => {
  const { gemBaseAttack, gemKind } = await import("../lib/character/detail");
  assert.equal(gemKind("10레벨 겁화의 보석"), "뎀");
  assert.equal(gemKind("8레벨 작열의 보석"), "쿨");
  assert.equal(gemKind("7레벨 멸화의 보석"), "뎀");
  assert.equal(gemKind("5레벨 홍염의 보석"), "쿨");
  assert.equal(gemKind("광휘의 보석"), "광휘");
  assert.equal(gemKind(null), null);
  assert.equal(gemBaseAttack("<FONT COLOR='#FFD200'>기본 공격력</FONT> +4.95%"), 4.95);
  assert.equal(gemBaseAttack("효과 없음"), null);
});

test("stone bonus reads the 세공 bonus line and ignores stones without one", () => {
  const stone = (effects: { title: string; lines: string[] }[]) =>
    ({ type: "어빌리티 스톤", detail: { effects } }) as unknown as Parameters<typeof stoneBonus>[0];
  assert.equal(
    stoneBonus(stone([{ title: "세공 단계 보너스", lines: ["<FONT COLOR='#FFD200'>기본 공격력 +1.5%</FONT>"] }])),
    "기본 공격력 +1.50%",
  );
  assert.equal(stoneBonus(stone([{ title: "무작위 각인 효과", lines: ["[원한] 활성도 +6"] }])), null);
  assert.equal(stoneBonus(null), null);
});
