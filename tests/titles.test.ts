import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { byObservedOrder, groupByDay, isTitlesEnvelope, requestTitles, titleDate } from "../lib/character/titles";

const fixture = () =>
  JSON.parse(readFileSync(new URL("./titles-fixtures/character-titles.json", import.meta.url), "utf8"));

test("backend sample satisfies the captured contract; empty records are valid", () => {
  assert.equal(isTitlesEnvelope(fixture()), true);
  const empty = fixture();
  empty.data.titles = [];
  empty.data.observedCharacters = 0;
  assert.equal(isTitlesEnvelope(empty), true);
  // A backend from before #176 (no firstObservedDate) is still accepted.
  const older = fixture();
  for (const title of older.data.titles) delete title.firstObservedDate;
  assert.equal(isTitlesEnvelope(older), true);
  const broken = fixture();
  broken.data.titles[0].firstObservedAt = "어제";
  assert.equal(isTitlesEnvelope(broken), false);
  // A future OFFICIAL-like source the build does not know keeps the list.
  const newer = fixture();
  newer.data.titles[0].source = "IMPORTED";
  assert.equal(isTitlesEnvelope(newer), true);
});

test("first-seen order and KST dates", () => {
  const titles = fixture().data.titles;
  assert.deepEqual(
    byObservedOrder([...titles].reverse()).map((t: { title: string }) => t.title),
    ["별을 제패한 자", "이클립스"],
  );
  assert.equal(titleDate("2026-09-30T15:30:00Z"), "2026.10.01");
});

test("title requests validate the name and allow-list errors", async () => {
  let calls = 0;
  const fetcher = (async (input: URL) => {
    calls++;
    assert.equal(input.pathname, "/api/v1/characters/titles");
    return Response.json({ code: "CHARACTER_HISTORY_DISABLED", message: "secret" }, { status: 503 });
  }) as unknown as typeof fetch;
  assert.equal((await requestTitles("a b", "http://127.0.0.1:8080", { fetcher })).ok, false);
  assert.equal(calls, 0);
  assert.deepEqual(await requestTitles("칭호본캐", "http://127.0.0.1:8080", { fetcher }), {
    ok: false,
    error: { code: "CHARACTER_HISTORY_DISABLED", status: 503 },
  });
});

test("titles first seen on the same KST day fold into one group (backend #176)", () => {
  // Without firstObservedDate (older backend) the KST date of firstObservedAt is used.
  const t = (title: string, at: string, observedOrder: number, firstObservedDate?: string) => ({
    title, firstObservedAt: at, lastObservedAt: at, observedOrder, recordedBy: "본캐", source: "OBSERVED" as const,
    ...(firstObservedDate && { firstObservedDate }),
  });
  const groups = groupByDay([
    t("A", "2026-10-01T01:00:00Z", 1),
    t("B", "2026-10-01T09:00:00Z", 2),
    t("C", "2026-10-01T15:30:00Z", 3), // 10-02 00:30 KST: the next day
    t("D", "2026-10-03T00:00:00Z", 4, "2026-10-04"),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.day, g.titles.map((x) => x.title).join("")]),
    [["2026.10.01", "AB"], ["2026.10.02", "C"], ["2026.10.04", "D"]],
  );
});
