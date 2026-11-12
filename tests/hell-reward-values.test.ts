import assert from "node:assert/strict";
import test from "node:test";
import { cleanValues, touchedLast } from "../lib/tools/hell-reward-values";

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
  const many = cleanValues(Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`item:${i}`, "1"])));
  assert.equal(Object.keys(many).length, 200);
  // codex #1549 P3: the newest are kept at the cap; the oldest are dropped.
  assert.equal(many["item:299"], "1");
  assert.equal(many["item:0"], undefined);
});
// codex #1549 P3: with 200 stored, a value typed now survives (the least recently typed goes), and a
// changed old value counts as typed now.
test("hell reward stored values: a value typed at the cap is kept", () => {
  const full = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`item:${i}`, "1"]));
  const added = cleanValues(touchedLast(full, { ...full, "item:new": "7" }));
  assert.equal(added["item:new"], "7");
  assert.equal(added["item:0"], undefined);
  const changed = cleanValues(touchedLast(added, { ...added, "item:1": "9", "item:new2": "3" }));
  assert.equal(changed["item:1"], "9");
  assert.equal(changed["item:new2"], "3");
  assert.equal(changed["item:2"], undefined);
  assert.deepEqual(Object.keys(touchedLast({ "item:a": "1", "item:b": "2" }, { "item:a": "5", "item:b": "2" })), ["item:b", "item:a"]);
});