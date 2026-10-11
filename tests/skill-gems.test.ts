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
  assert.deepEqual(skillGems(gems, "블레이드 버스트").map((g) => g.label), ["10뎀", "8쿨"]);
  assert.deepEqual(skillGems(gems, "서프라이즈 어택").map((g) => g.label), ["6쿨"]);
  assert.deepEqual(skillGems(gems, "터닝 슬래쉬").map((g) => g.label), ["6뎀"]);
  assert.deepEqual(skillGems(gems, "없는 스킬"), []);
  assert.deepEqual(skillGems(null, "블레이드 버스트"), []);
});
