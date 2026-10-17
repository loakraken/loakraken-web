import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isViewsEnvelope } from "../lib/character/validate";
import { requestViews } from "../lib/character/related";
import { monthLabels, viewDateLabel, viewLevel, viewWeeks } from "../lib/character/views";

const fixture = () =>
  JSON.parse(
    readFileSync(new URL("./views-fixtures/character-views.json", import.meta.url), "utf8"),
  );
const origin = "http://127.0.0.1:8080";

test("backend-generated views fixture satisfies the contract", () => {
  assert.equal(isViewsEnvelope(fixture()), true);
  const negative = fixture();
  negative.data.days[3].count = -1;
  assert.equal(isViewsEnvelope(negative), false);
  const unordered = fixture();
  unordered.data.days.reverse();
  assert.equal(isViewsEnvelope(unordered), false);
});

test("heatmap columns are Sunday-first weeks padded at both ends", () => {
  const days = fixture().data.days;
  const weeks = viewWeeks(days);
  assert.ok(weeks.every((week) => week.length === 7));
  assert.equal(weeks.flat().filter(Boolean).length, days.length);
  // 2026-06-19 is a Friday: five empty cells before it.
  assert.equal(weeks[0].findIndex(Boolean), 5);
  assert.equal(weeks.flat().filter(Boolean).at(-1)!.date, "2026-10-08");
});

test("levels scale to the busiest day and month labels never crowd", () => {
  assert.equal(viewLevel(0, 10), 0);
  assert.equal(viewLevel(1, 10), 1);
  assert.equal(viewLevel(6, 10), 3);
  assert.equal(viewLevel(10, 10), 4);
  const labels = monthLabels(viewWeeks(fixture().data.days));
  assert.deepEqual(labels.map((l) => l.text), ["7월", "8월", "9월", "10월"]);
  for (let i = 1; i < labels.length; i++)
    assert.ok(labels[i].column - labels[i - 1].column >= 3);
  assert.equal(viewDateLabel("2026-10-08"), "10월 8일");
});

test("views requests validate input and pass through allow-listed errors", async () => {
  let calls = 0;
  const fetcher = (async (url: URL) => {
    calls++;
    assert.equal(url.pathname, "/api/v1/characters/views");
    assert.equal(url.searchParams.get("days"), "112");
    return Response.json(fixture());
  }) as unknown as typeof fetch;
  assert.equal((await requestViews("목캐릭터A", origin, { fetcher })).ok, true);
  assert.equal((await requestViews("목캐릭터A", origin, { fetcher, days: 400 })).ok, false);
  assert.equal((await requestViews("", origin, { fetcher })).ok, false);
  assert.equal(calls, 1);
  const disabled = await requestViews("목캐릭터A", origin, {
    fetcher: (async () =>
      Response.json({ code: "CHARACTER_VIEWS_DISABLED" }, { status: 503 })) as typeof fetch,
  });
  assert.deepEqual(disabled.ok ? null : disabled.error, {
    code: "CHARACTER_VIEWS_DISABLED",
    status: 503,
  });
});
