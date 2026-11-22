// QA v0.3.15 RC P2-1 (PM 총괄 11-22 09:08): the simulator's gem rows showed only the gem's name, so on real data
// eleven rows and selects read '6레벨 광휘의 보석 (귀속)'. Each row is named by its skill, as the spec-up list does.
import assert from "node:assert/strict";
import test from "node:test";
import { gemLabels } from "../lib/combat-power/model";

const gem = (slot: number, name = "6레벨 광휘의 보석 (귀속)") => ({ slot, name });

test("each gem row: its skill and the gem, unique", () => {
  const labels = gemLabels(
    [gem(0), gem(1), gem(2, "7레벨 겁화의 보석")],
    [
      { gemSlot: 0, name: "블레이드 버스트" },
      { gemSlot: 1, name: "마엘스트롬" },
      { gemSlot: 2, name: "블레이드 버스트" },
    ],
  );
  assert.deepEqual([...labels.entries()], [
    [0, "블레이드 버스트 · 6레벨 광휘의 보석 (귀속)"],
    [1, "마엘스트롬 · 6레벨 광휘의 보석 (귀속)"],
    [2, "블레이드 버스트 · 7레벨 겁화의 보석"],
  ]);
});

test("no skill for a slot, or the same skill and gem twice: the slot number keeps them apart", () => {
  const labels = gemLabels(
    [gem(0), gem(1), gem(4), gem(5)],
    [
      { gemSlot: 0, name: "블레이드 버스트" },
      { gemSlot: 1, name: "블레이드 버스트" },
    ],
  );
  assert.deepEqual([...labels.values()], [
    "블레이드 버스트 · 6레벨 광휘의 보석 (귀속) (1번 칸)",
    "블레이드 버스트 · 6레벨 광휘의 보석 (귀속) (2번 칸)",
    "6레벨 광휘의 보석 (귀속) (5번 칸)",
    "6레벨 광휘의 보석 (귀속) (6번 칸)",
  ]);
  assert.equal(new Set(labels.values()).size, 4);
});

test("a lone gem without a skill keeps just its name; no effects at all is fine", () => {
  assert.deepEqual([...gemLabels([gem(3, "8레벨 작열의 보석")], null).values()], ["8레벨 작열의 보석"]);
  assert.deepEqual([...gemLabels([], undefined).values()], []);
});
