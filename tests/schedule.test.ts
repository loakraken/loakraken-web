import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryOfPath,
  dayKinds,
  isScheduleCategory,
  mergeSameRounds,
  resetLeft,
  scheduleGroups,
  schedulePath,
  upcomingRounds,
} from "../lib/home/schedule";
import type { Schedule } from "../lib/home/model";

const at = (hhmm: string) => `2026-10-10T${hhmm}:00+09:00`;
const timed = (name: string, times: string[]) => ({
  name,
  icon: null,
  minItemLevel: 1,
  startTimes: times.map(at),
  rewardGroups: [],
  nextAt: times.length ? at(times[0]) : null,
});
const day = {
  date: "2026-10-10",
  adventureIslands: [{ ...timed("포르페", ["19:00", "21:00"]), rewardKinds: ["CARD_PACK"] }],
  chaosGates: [timed("일렁이는 악마군단", ["18:50", "19:50"])],
  fieldBosses: [],
  others: [
    { category: "항해", ...timed("항해 협동 : 베른", ["19:30"]) },
    { category: "섬", ...timed("지스브로이", ["19:20"]) },
    { category: "섬", ...timed("그릇된 욕망의 섬", ["19:20"]) },
    { category: "새 분류", ...timed("새 일정", ["20:00"]) },
  ],
} as unknown as Schedule;

test("category paths: known slugs only, null for the whole schedule", () => {
  assert.equal(categoryOfPath("/schedule"), null);
  assert.equal(categoryOfPath("/schedule/sailing"), "sailing");
  assert.equal(categoryOfPath("/schedule/sailing/"), "sailing");
  assert.equal(categoryOfPath("/schedule/unknown"), null);
  assert.equal(categoryOfPath("/schedule/sailing/x"), null);
  assert.equal(isScheduleCategory("rowen"), true);
  assert.equal(schedulePath(null), "/schedule");
  assert.equal(schedulePath("island"), "/schedule/island");
});

test("groups: fixed lists, then others by official category in page order, new ones last", () => {
  const groups = scheduleGroups(day);
  assert.deepEqual(
    groups.map((group) => [group.key, group.items.length]),
    [
      ["adventure-island", 1],
      ["chaos-gate", 1],
      ["field-boss", 0],
      ["origin-island", 0],
      ["island", 2],
      ["sailing", 1],
      ["rowen", 0],
      ["other:새 분류", 1],
    ],
  );
  assert.equal(groups.at(-1)?.slug, null);
});

test("upcoming: next round today per group with the names starting then", () => {
  const now = Date.parse(at("19:05"));
  const rounds = upcomingRounds(scheduleGroups(day), now);
  assert.deepEqual(
    rounds.map((round) => [round.label, round.at, round.names]),
    [
      ["모험 섬", at("21:00"), ["포르페"]],
      ["카오스게이트", at("19:50"), ["일렁이는 악마군단"]],
      ["섬", at("19:20"), ["지스브로이", "그릇된 욕망의 섬"]],
      ["항해", at("19:30"), ["항해 협동 : 베른"]],
      ["새 분류", at("20:00"), ["새 일정"]],
    ],
  );
});

test("chaos gates with the same rounds and rewards are one row naming the category, places kept", () => {
  const gate = (name: string, minItemLevel: number, times = ["18:50", "19:50"]) => ({ ...timed(name, times), minItemLevel });
  const gates = [gate("일렁이는 악마군단", 1580), gate("쿠르잔 북부", 1600), gate("베른 남부", 1580)];
  const merged = mergeSameRounds(gates, "카오스게이트");
  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "카오스게이트");
  assert.equal(merged[0].minItemLevel, 1580);
  assert.deepEqual(merged[0].places?.map((place) => [place.name, place.minItemLevel]), [
    ["일렁이는 악마군단", 1580],
    ["쿠르잔 북부", 1600],
    ["베른 남부", 1580],
  ]);
  // One unlike the rest stays as it is.
  const mixed = mergeSameRounds([...gates, gate("다른 회차", 1640, ["20:50"])], "카오스게이트");
  assert.deepEqual(mixed.map((row) => [row.name, row.places?.length ?? 0]), [["카오스게이트", 3], ["다른 회차", 0]]);
  // A single gate is not renamed.
  assert.deepEqual(mergeSameRounds([gates[0]], "카오스게이트").map((row) => row.name), ["일렁이는 악마군단"]);
  // The upcoming strip names the merged row once, not each place.
  const now = Date.parse(at("19:05"));
  const rounds = upcomingRounds(scheduleGroups({ ...day, chaosGates: gates } as Schedule), now);
  assert.deepEqual(rounds.find((round) => round.key === "chaos-gate")?.names, ["카오스게이트"]);
});

test("day kinds for the date line", () => {
  assert.deepEqual(dayKinds(day), ["카오스게이트"]);
  assert.deepEqual(dayKinds({ ...day, chaosGates: [], fieldBosses: day.chaosGates } as Schedule), ["필드 보스"]);
  assert.deepEqual(dayKinds({ ...day, chaosGates: [] } as Schedule), []);
});

test("weekly reset: Wednesday 06:00 KST", () => {
  // Saturday 18:31 → Wednesday 06:00 is 3 days 11 hours 29 minutes away.
  assert.equal(resetLeft(Date.parse("2026-10-10T18:31:00+09:00")), "3일 11시간");
  assert.equal(resetLeft(Date.parse("2026-10-14T00:30:00+09:00")), "5시간 30분");
  // Right at the reset the next one is a week away.
  assert.equal(resetLeft(Date.parse("2026-10-14T06:00:00+09:00")), "7일 0시간");
});
