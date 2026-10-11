import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORY_LIMIT,
  historyReducer,
  isEmpty,
  parseSaved,
  serializeSaved,
  startHistory,
  type History,
} from "../lib/combat-power/history";
import { NO_EDITS, type Edits } from "../lib/combat-power/model";

const withGem = (level: number): Edits => ({ ...NO_EDITS, gems: { 0: level } });
const run = (history: History, ...actions: Parameters<typeof historyReducer>[1][]) =>
  actions.reduce(historyReducer, history);

test("이전·다음 walk back and forth, and a new edit clears 다음", () => {
  let h = run(startHistory(), { type: "set", next: withGem(8) }, { type: "set", next: withGem(9) });
  assert.deepEqual(h.present, withGem(9));
  h = historyReducer(h, { type: "undo" });
  assert.deepEqual(h.present, withGem(8));
  assert.equal(h.future.length, 1);
  h = historyReducer(h, { type: "redo" });
  assert.deepEqual(h.present, withGem(9));
  h = run(h, { type: "undo" }, { type: "set", next: withGem(10) });
  assert.deepEqual(h.present, withGem(10));
  assert.equal(h.future.length, 0, "a new edit drops what 다음 held");
});

test("undo and redo at the ends do nothing", () => {
  const start = startHistory();
  assert.equal(historyReducer(start, { type: "undo" }), start);
  assert.equal(historyReducer(start, { type: "redo" }), start);
});

test("초기화 is a step 이전 can undo, and does nothing on empty inputs", () => {
  const start = startHistory();
  assert.equal(historyReducer(start, { type: "reset" }), start);
  let h = run(start, { type: "set", next: withGem(9) }, { type: "reset" });
  assert.ok(isEmpty(h.present));
  h = historyReducer(h, { type: "undo" });
  assert.deepEqual(h.present, withGem(9));
});

test("functional set reads the latest present", () => {
  const h = run(
    startHistory(),
    { type: "set", next: (p) => ({ ...p, gemAll: 7 }) },
    { type: "set", next: (p) => ({ ...p, quality: { 1: 100 } }) },
  );
  assert.equal(h.present.gemAll, 7);
  assert.deepEqual(h.present.quality, { 1: 100 });
});

test(`이전 keeps at most ${HISTORY_LIMIT} steps`, () => {
  let h = startHistory();
  for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = historyReducer(h, { type: "set", next: withGem(i) });
  assert.equal(h.past.length, HISTORY_LIMIT);
});

test("saved inputs round-trip and drop malformed entries", () => {
  const edits: Edits = {
    ...NO_EDITS,
    gemAll: 9,
    quality: { 1: 100 },
    polish: { "3:0": "HIGH" },
    core: { 0: { grade: "유물", point: 17 } },
  };
  const saved = parseSaved(serializeSaved(edits, new Date("2026-10-11T10:00:00Z")));
  assert.deepEqual(saved?.edits, edits);
  assert.equal(saved?.savedAt, "2026-10-11T10:00:00.000Z");

  const junk = parseSaved(
    JSON.stringify({
      savedAt: "x",
      edits: { gemAll: "9", gems: { 0: "10", 1: 8 }, polish: { a: "TOP" }, core: { 0: { grade: 1 } } },
    }),
  );
  assert.equal(junk?.edits.gemAll, null);
  assert.deepEqual(junk?.edits.gems, { 1: 8 });
  assert.deepEqual(junk?.edits.polish, {});
  assert.deepEqual(junk?.edits.core, {});
  assert.deepEqual(junk?.edits.stone, {}, "missing groups become empty");

  assert.equal(parseSaved(null), null);
  assert.equal(parseSaved("{"), null);
  assert.equal(parseSaved(JSON.stringify({ edits: [] , savedAt: "x" })), null);
});
