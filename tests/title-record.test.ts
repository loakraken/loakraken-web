import assert from "node:assert/strict";
import test from "node:test";
import { titlePercent, titleRecordRows, titleRecordSummary } from "../lib/character/title-record";

const titles = [
  { title: "별을 제패한 자", firstObservedDate: "2024-09-10" },
  { title: "빛을 꺼트리는 자", firstObservedDate: "2024-12-24" },
  { title: "몽환의 현시자", firstObservedDate: "2024-12-24" },
  { title: "이클립스", firstObservedDate: "2025-01-02" },
];

test("title record: rarest first by the equip-record rate; not-ready samples last as collecting", () => {
  const rows = titleRecordRows(titles, [
    { title: "별을 제패한 자", observedPercent: 40.5, observedCharacters: 900, sampleReady: true },
    { title: "빛을 꺼트리는 자", observedPercent: 5.17, observedCharacters: 31, sampleReady: true },
    // Not ready: no rate shown, the sample size kept for "표본 12명 — 모으는 중".
    { title: "몽환의 현시자", observedPercent: 1.2, observedCharacters: 12, sampleReady: false },
    // 이클립스: no rate from the backend at all (before api #697) → last, no sample.
  ]);
  assert.deepEqual(
    rows.map((row) => [row.title, row.percent, row.sample]),
    [
      ["빛을 꺼트리는 자", 5.17, null],
      ["별을 제패한 자", 40.5, null],
      ["몽환의 현시자", null, 12],
      ["이클립스", null, null],
    ],
  );
  const summary = titleRecordSummary(rows);
  assert.equal(summary.count, 4);
  assert.equal(summary.rarest?.title, "빛을 꺼트리는 자");
  assert.equal(summary.first, "2024-09-10");
  assert.equal(titlePercent(5.17), "5.17%");
});

test("title record: without any rate the list keeps record order and has no rarest", () => {
  const rows = titleRecordRows(titles, []);
  assert.deepEqual(rows.map((row) => row.title), titles.map((t) => t.title));
  assert.equal(titleRecordSummary(rows).rarest, null);
  assert.deepEqual(titleRecordSummary([]), { count: 0, rarest: null, first: null });
});
