import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  change,
  historySummary,
  niceTicks,
  shortDate,
  stepSeries,
  valueAt,
} from "../lib/character/history";
import {
  isHistoryEnvelope,
  isSiblingsEnvelope,
} from "../lib/character/validate";
import { requestHistory, requestSiblings } from "../lib/character/related";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const history = () => read("./history-fixtures/character-history.json");
const origin = "http://127.0.0.1:8080";

test("backend-generated history and siblings fixtures satisfy their contracts", () => {
  assert.equal(isHistoryEnvelope(history()), true);
  assert.equal(
    isSiblingsEnvelope(read("./siblings-fixtures/character-siblings.json")),
    true,
  );
  const broken = history();
  broken.data.points[0].observedAt = "어제";
  assert.equal(isHistoryEnvelope(broken), false);
});

test("step series follows observations and extends the last value to lastConfirmedAt", () => {
  const point = (
    observedAt: string,
    lastConfirmedAt: string,
    itemLevel: number,
    combatPower: number | null,
  ) => ({
    observedAt,
    lastConfirmedAt,
    className: "바드",
    characterLevel: 70,
    itemLevel,
    combatPower,
    expeditionLevel: 260,
  });
  const points = [
    point("2026-10-05T00:20:00Z", "2026-10-05T00:20:00Z", 1710, null),
    point("2026-10-05T00:00:00Z", "2026-10-05T00:10:00Z", 1700, 4000),
    point("2026-10-05T00:30:00Z", "2026-10-05T01:00:00Z", 1720, 4100),
  ];
  const steps = stepSeries(points, "itemLevel");
  assert.deepEqual(
    steps.map((s) => s.v),
    [1700, 1710, 1720, 1720],
  );
  assert.equal(steps.at(-1)!.t, Date.parse("2026-10-05T01:00:00Z"));
  assert.deepEqual(
    stepSeries(points, "combatPower").map((s) => s.v),
    [4000, 4100, 4100],
    "null skipped",
  );
  assert.equal(valueAt(steps, Date.parse("2026-10-05T00:25:00Z")), 1710);
  assert.equal(valueAt(steps, Date.parse("2026-10-04T00:00:00Z")), null);
  assert.equal(change(steps), 20);
  assert.equal(change(stepSeries([points[1]], "itemLevel").slice(0, 1)), null);
});

test("ticks are clean numbers that cover the range", () => {
  assert.deepEqual(niceTicks(1700, 1780), [1700, 1720, 1740, 1760, 1780]);
  assert.deepEqual(niceTicks(0, 3180), [0, 1000, 2000, 3000, 4000]);
  const flat = niceTicks(364, 364);
  assert.ok(flat[0] <= 364 && flat.at(-1)! >= 364);
});

test("history and siblings requests validate input before calling the backend", async () => {
  let calls = 0;
  const fetcher = (async (url: URL) => {
    calls++;
    assert.equal(url.pathname, "/api/v1/characters/history");
    assert.equal(url.searchParams.get("serverName"), "루페온");
    assert.equal(url.searchParams.get("limit"), "200");
    return Response.json(history());
  }) as unknown as typeof fetch;
  assert.equal(
    (await requestHistory("그래프이력", " 루페온 ", origin, { fetcher })).ok,
    true,
  );
  assert.equal(
    (await requestHistory("이름", "서버!", origin, { fetcher })).ok,
    false,
  );
  assert.equal((await requestSiblings("", origin, { fetcher })).ok, false);
  assert.equal(calls, 1);
  const disabled = await requestHistory("이름", "루페온", origin, {
    fetcher: (async () =>
      Response.json(
        { code: "CHARACTER_HISTORY_DISABLED" },
        { status: 503 },
      )) as typeof fetch,
  });
  assert.deepEqual(disabled.ok ? null : disabled.error, {
    code: "CHARACTER_HISTORY_DISABLED",
    status: 503,
  });
});

test("history summary: now, highest, change and the KST period", () => {
  const t = (iso: string) => Date.parse(iso);
  const steps = [
    { t: t("2023-03-13T16:00:00Z"), v: 1510 }, // 03-14 01:00 KST
    { t: t("2024-02-01T00:00:00Z"), v: 1680 },
    { t: t("2025-06-01T00:00:00Z"), v: 1770 },
    { t: t("2026-10-11T00:00:00Z"), v: 1760 },
  ];
  const summary = historySummary(steps, t("2026-10-12T05:00:00Z"));
  assert.deepEqual(summary, { current: 1760, best: 1770, delta: 250, since: steps[0].t, days: 1308 });
  assert.equal(shortDate(steps[0].t), "23.03.14");
  // One record: no change yet; no records: nothing to show.
  assert.equal(historySummary([steps[0]], steps[0].t)?.delta, null);
  assert.equal(historySummary([], 0), null);
});
