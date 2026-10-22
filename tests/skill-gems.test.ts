import assert from "node:assert/strict";
import test from "node:test";
import { skillGems } from "../lib/character/detail";

type Gems = Parameters<typeof skillGems>[0];

test("skill gem chips: level plus kind, radiance gems read the effect text", () => {
  const gem = (slot: number, name: string, level: number) =>
    ({ slot, name, icon: null, level, grade: "전설", titleLine: null, itemLevel: null, tier: null, tradeLines: [] });
  const gems = {
    items: [gem(0, "10레벨 겁화의 보석", 10), gem(1, "8레벨 작열의 보석", 8), gem(2, "6레벨 광휘의 보석", 6), gem(3, "6레벨 광휘의 보석", 6)],
    effects: {
      description: null,
      skills: [
        { gemSlot: 0, name: "블레이드 버스트", description: ["피해 40.00% 증가"], option: null, icon: null },
        { gemSlot: 1, name: "블레이드 버스트", description: ["재사용 대기시간 20.00% 감소"], option: null, icon: null },
        { gemSlot: 2, name: "서프라이즈 어택", description: ["재사용 대기시간 16.00% 감소"], option: null, icon: null },
        { gemSlot: 3, name: "터닝 슬래쉬", description: ["피해 28.00% 증가"], option: null, icon: null },
      ],
    },
  } as unknown as Gems;
  assert.deepEqual(skillGems(gems, "블레이드 버스트").map((g) => g.label), ["10겁", "8작"]);
  assert.deepEqual(skillGems(gems, "블레이드 버스트").map((g) => g.cooldown), [false, true]);
  assert.deepEqual(skillGems(gems, "서프라이즈 어택").map((g) => g.label), ["6작"]);
  assert.deepEqual(skillGems(gems, "터닝 슬래쉬").map((g) => g.label), ["6겁"]);
  assert.deepEqual(skillGems(gems, "없는 스킬"), []);
  assert.deepEqual(skillGems(null, "블레이드 버스트"), []);
});

test("gem counts for the skill tab: damage, cooldown (radiance by effect), empty of 11", async () => {
  const { gemCounts } = await import("../lib/character/detail");
  const gem = (slot: number, name: string) =>
    ({ slot, name, icon: null, level: 10, grade: "전설", titleLine: null, itemLevel: null, tier: null, tradeLines: [] });
  const gems = {
    items: [gem(0, "10레벨 겁화의 보석"), gem(1, "10레벨 작열의 보석"), gem(2, "6레벨 광휘의 보석"), gem(3, "6레벨 광휘의 보석")],
    effects: {
      description: null,
      skills: [
        { gemSlot: 2, name: "A", description: ["재사용 대기시간 16.00% 감소"], option: null, icon: null },
        { gemSlot: 3, name: "B", description: ["피해 28.00% 증가"], option: null, icon: null },
      ],
    },
  } as unknown as Parameters<typeof gemCounts>[0];
  assert.deepEqual(gemCounts(gems), { damage: 2, cooldown: 2, empty: 7 });
  assert.deepEqual(gemCounts(null), { damage: 0, cooldown: 0, empty: 11 });
});

test("stagger grade from the official tooltip line", async () => {
  const { staggerOf } = await import("../lib/character/item-tooltips");
  assert.equal(staggerOf(["PvE", "마나 41 소모", "무력화 : 하", "공격 타입 : 백 어택"]), "하");
  assert.equal(staggerOf(["무력화 : 최상"]), "최상");
  assert.equal(staggerOf(["PvE"]), null);
  assert.equal(staggerOf(undefined), null);
});
