import assert from "node:assert/strict";
import test from "node:test";
import { binLabel, guildDetailPath, parseGuildDetailQuery } from "../lib/stats/guild-detail";
import { requestGuildDetail } from "../lib/stats/guild-detail.backend";

test("guild tab query: names as the backend checks, days 7·30·90 else 30", () => {
  assert.deepEqual(parseGuildDetailQuery("루페온", "합성길드", new URLSearchParams("activeDays=7")), {
    serverName: "루페온",
    guildName: "합성길드",
    activeDays: 7,
  });
  assert.equal(parseGuildDetailQuery("루페온", "합성길드", new URLSearchParams("activeDays=14"))!.activeDays, 30);
  assert.equal(parseGuildDetailQuery("루페온", "합성 길드", new URLSearchParams()), null);
  assert.equal(parseGuildDetailQuery("루페온", "가나다라마바사아자차카타파", new URLSearchParams()), null);
  assert.equal(parseGuildDetailQuery("", "길드", new URLSearchParams()), null);
});

test("guild tab paths: web route and backend request", async () => {
  assert.equal(
    guildDetailPath({ serverName: "루페온", guildName: "합성길드", activeDays: 90 }),
    `/api/guilds/${encodeURIComponent("루페온")}/${encodeURIComponent("합성길드")}?activeDays=90`,
  );
  let asked = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify({ code: "STATS_GUILD_NOT_OBSERVED", message: "", data: null }), { status: 404 });
  }) as typeof fetch;
  const result = await requestGuildDetail({ serverName: "루페온", guildName: "합성길드", activeDays: 7 }, "http://backend.test", { fetcher });
  const url = new URL(asked);
  assert.equal(decodeURIComponent(url.pathname), "/api/v1/guilds/루페온/합성길드");
  assert.equal(url.searchParams.get("activeDays"), "7");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "STATS_GUILD_NOT_OBSERVED");
});

test("guild tab bins read as ranges", () => {
  const bins = [{ from: 1680, count: 2 }, { from: 1690, count: 1 }];
  assert.equal(binLabel(bins, 0, 10), "1,680~1,690");
  assert.equal(binLabel([{ from: 2300, count: 1 }], 0, 100), "2,300~2,400");
});
