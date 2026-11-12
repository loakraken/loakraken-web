import assert from "node:assert/strict";
import test from "node:test";
import { cleanValues } from "../lib/tools/hell-reward-values";

// codex QA v0.3.11 P1: typed values come back from this browser; a stored or tampered value keeps
// only item keys with digit text.
test("hell reward stored values: only item keys with digit text survive", () => {
  assert.deepEqual(cleanValues({ "item:용암의 숨결": "10", "item:팔찌:ANCIENT": "1.5", "unsettled:abyss:1750:stoneKit": "3" }), {
    "item:용암의 숨결": "10",
    "item:팔찌:ANCIENT": "1.5",
    "unsettled:abyss:1750:stoneKit": "3",
  });
  assert.deepEqual(cleanValues({ "item:a": "<b>", "item:b": 5, other: "1", "item:c": "" }), {});
  assert.deepEqual(cleanValues(null), {});
  assert.deepEqual(cleanValues(["item:a"]), {});
  assert.equal(Object.keys(cleanValues(Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`item:${i}`, "1"])))).length, 200);
});