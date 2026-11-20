import { test } from "node:test";
import assert from "node:assert/strict";
import { daySlots, gapBridges, gapsBefore, slotDate } from "../lib/market/chart-gaps";
import { ACCESSORY_WARMUP_SINCE, accessoryGapNote, isWarmedFilter } from "../lib/market/warmup-since";

const t = (date: string) => Date.parse(`${date}T00:00:00Z`);
const times = ["2026-10-18", "2026-10-19", "2026-10-22", "2026-10-24", "2026-10-25"].map(t);
const warmed = { grade: "ANCIENT", role: "DEALER", minQuality: 70 } as const;

test("daySlots: every day from first to last, missing days without a reading", () => {
  const slots = daySlots(times);
  assert.equal(slots.length, 8);
  assert.deepEqual(
    slots.map((s) => [slotDate(s.t), s.reading]),
    [
      ["2026-10-18", 0],
      ["2026-10-19", 1],
      ["2026-10-20", null],
      ["2026-10-21", null],
      ["2026-10-22", 2],
      ["2026-10-23", null],
      ["2026-10-24", 3],
      ["2026-10-25", 4],
    ],
  );
  assert.deepEqual(daySlots([]), []);
  assert.deepEqual(daySlots([t("2026-10-18")]), [{ t: t("2026-10-18"), reading: 0 }]);
});

test("daySlots · gapBridges: times out of order or a day twice → one slot per reading, no bridge", () => {
  const unsorted = ["2026-10-22", "2026-10-18", "2026-10-19"].map(t);
  assert.deepEqual(
    daySlots(unsorted).map((s) => s.reading),
    [0, 1, 2],
  );
  assert.deepEqual(gapBridges(unsorted), []);
  const twice = ["2026-10-18", "2026-10-18", "2026-10-21"].map(t);
  assert.equal(daySlots(twice).length, 3);
  assert.ok(daySlots(twice).every((s) => s.reading != null));
  assert.deepEqual(gapBridges(twice), []);
  // Not a midnight (a stray timestamp): same fallback.
  assert.deepEqual(gapBridges([t("2026-10-18"), t("2026-10-21") + 3_600_000]), []);
});

test("gapBridges: one per gap, joining the readings on either side", () => {
  assert.deepEqual(gapBridges(times), [
    [1, 2],
    [2, 3],
  ]);
  assert.deepEqual(gapBridges(times.slice(0, 2)), []);
});

test("gapsBefore: a missing day before the start date", () => {
  assert.equal(gapsBefore(times, "2026-10-21"), true);
  assert.equal(gapsBefore(times, "2026-10-20"), false);
  assert.equal(gapsBefore(times, null), false);
});

test("accessoryGapNote: no gap → none; not warmed or no start → viewed days only; warmed → the start date", () => {
  const full = ["2026-10-18", "2026-10-19", "2026-10-20"].map(t);
  assert.equal(accessoryGapNote(warmed, full, "2026-10-01"), null);
  assert.equal(accessoryGapNote(warmed, times, null), "이 칸은 누가 조회한 날만 기록돼요");
  assert.equal(accessoryGapNote({ ...warmed, role: "SUPPORT" }, times, "2026-10-01"), "이 칸은 누가 조회한 날만 기록돼요");
  assert.equal(accessoryGapNote(warmed, times, "2026-10-23"), "이 칸은 10/23 전에는 누가 조회한 날만 기록돼요");
  // Every missing day after the start: nothing to explain beyond the gap itself.
  assert.equal(accessoryGapNote(warmed, times, "2026-10-20"), null);
  assert.equal(isWarmedFilter({ ...warmed, minQuality: 90 }), false);
});

test("accessoryGapNote: the published warmup start is the default (11/20)", () => {
  assert.equal(ACCESSORY_WARMUP_SINCE, "2026-11-20");
  const before = ["2026-11-17", "2026-11-19", "2026-11-20"].map(t);
  assert.equal(accessoryGapNote(warmed, before), "이 칸은 11/20 전에는 누가 조회한 날만 기록돼요");
  const after = ["2026-11-20", "2026-11-22", "2026-11-23"].map(t);
  assert.equal(accessoryGapNote(warmed, after), null);
  assert.equal(accessoryGapNote({ ...warmed, minQuality: 90 }, after), "이 칸은 누가 조회한 날만 기록돼요");
});
