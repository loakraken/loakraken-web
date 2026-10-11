import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORY_LIMIT,
  applySaved,
  historyReducer,
  isEmpty,
  parseSaved,
  serializeSaved,
  startHistory,
  type History,
  type Identity,
} from "../lib/combat-power/history";
import { NO_EDITS, type Edits } from "../lib/combat-power/model";

const withGem = (level: number): Edits => ({ ...NO_EDITS, gems: { 0: level } });

/** A character as the simulator reads it (only what saved inputs check). */
const identity = (helmet = "+19 테스트 투구"): Identity => ({
  gems: [{ slot: 0, name: "10레벨 겁화의 보석" }],
  gear: [
    { index: 0, type: "무기", name: "+20 테스트 무기" },
    { index: 1, type: "투구", name: helmet },
  ],
  polish: [{ index: 3, line: 0, item: "테스트 목걸이", option: "추가 피해" }],
  bracelet: [],
  engravings: [{ name: "원한" }],
  stones: [],
  arkPassive: [],
  cores: [{ slotIndex: 0, name: "테스트 코어" }],
});
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
  const saved = parseSaved(serializeSaved(edits, new Date("2026-10-11T10:00:00Z"), identity()));
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

test("a saved input applies only to the gear it was aimed at (PM 총괄 10-12 01:54)", () => {
  const edits: Edits = {
    ...NO_EDITS,
    gemAll: 9,
    quality: { 0: 100, 1: 100 },
    engraving: { 원한: 4 },
    polish: { "3:0": "HIGH" },
  };
  const saved = parseSaved(serializeSaved(edits, new Date("2026-10-12T01:00:00Z"), identity()))!;
  // Same character: everything comes back.
  const same = applySaved(saved, identity());
  assert.ok(!("legacy" in same));
  assert.deepEqual(same.edits, edits);
  assert.equal(same.skipped, 0);
  // The helmet was replaced: its quality is left out and counted, the rest stays.
  const changed = applySaved(saved, identity("+18 다른 투구"));
  assert.ok(!("legacy" in changed));
  assert.deepEqual(changed.edits.quality, { 0: 100 });
  assert.deepEqual(changed.edits.engraving, { 원한: 4 });
  assert.equal(changed.edits.gemAll, 9);
  assert.equal(changed.skipped, 1);
  // An engraving the character no longer has is skipped too.
  const gone = applySaved(saved, { ...identity(), engravings: [] });
  assert.ok(!("legacy" in gone));
  assert.equal(gone.skipped, 1);
});

test("an old save without targets is not applied (asks to save again)", () => {
  const old = parseSaved(JSON.stringify({ edits: { ...NO_EDITS, quality: { 1: 100 } }, savedAt: "2026-10-11T10:00:00.000Z" }))!;
  assert.deepEqual(applySaved(old, identity()), { legacy: true });
});

test("a saved 팔 보호구 change applies only to the same 완갑 (sim v8)", () => {
  const edits: Edits = { ...NO_EDITS, armGuard: { level: 15 } };
  const withGuard = (name: string): Identity => ({ ...identity(), armGuard: { name } });
  const saved = parseSaved(serializeSaved(edits, new Date("2026-10-12T05:00:00Z"), withGuard("+13 전율 완갑")))!;
  assert.deepEqual(saved.edits.armGuard, { level: 15 });
  const same = applySaved(saved, withGuard("+13 전율 완갑"));
  assert.ok(!("legacy" in same) && same.edits.armGuard.level === 15 && same.skipped === 0);
  const other = applySaved(saved, withGuard("+10 다른 완갑"));
  assert.ok(!("legacy" in other));
  assert.deepEqual(other.edits.armGuard, {});
  assert.equal(other.skipped, 1);
});
