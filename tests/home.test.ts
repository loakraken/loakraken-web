import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  countdown,
  dayLabel,
  dDay,
  isDate,
  isPatchNote,
  kstDate,
  kstTime,
  maintenanceToday,
  nextOf,
  periodText,
  sectionStatus,
  tomorrowInWeek,
  upcomingMaintenance,
  weekDays,
} from "../lib/home/model";
import { isNewsEnvelope, isScheduleEnvelope } from "../lib/home/validate";
import { requestNews, requestSchedule } from "../lib/home/upstream";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./home-fixtures/${name}`, import.meta.url), "utf8"));
const origin = "http://127.0.0.1:8080";

test("backend-generated schedule and news fixtures satisfy the contract", () => {
  assert.equal(isScheduleEnvelope(fixture("home-schedule.json")), true);
  assert.equal(isNewsEnvelope(fixture("home-news.json")), true);
  const broken = fixture("home-schedule.json");
  broken.data.adventureIslands[0].nextAt = "곧";
  assert.equal(isScheduleEnvelope(broken), false);
});

test("week, time and countdown helpers use KST", () => {
  const days = weekDays("2026-10-07", "2026-10-13");
  assert.equal(days.length, 7);
  assert.deepEqual(days[0], { date: "2026-10-07", day: 7, weekday: "수" });
  assert.equal(days.at(-1)!.weekday, "화");
  assert.equal(kstTime("2026-10-08T23:00:00+09:00"), "23:00");
  const now = Date.parse("2026-10-08T22:30:17+09:00");
  assert.equal(countdown("2026-10-08T23:00:00+09:00", now), "29분 43초");
  assert.equal(countdown("2026-10-09T11:00:00+09:00", now), "12시간 29분");
  assert.equal(countdown("2026-10-08T22:00:00+09:00", now), null);
  assert.equal(kstDate(Date.parse("2026-10-08T23:30:00Z")), "2026-10-09");
  assert.equal(isDate("2026-02-30"), false);
});

test("events, maintenance banner and section countdown", () => {
  const now = Date.parse("2026-10-08T22:30:00+09:00");
  assert.equal(dDay("2026-10-12T06:00:00+09:00", now), "D-4");
  assert.equal(dDay("2026-10-08T23:59:00+09:00", now), "D-day");
  assert.equal(dDay("2026-10-07T23:59:00+09:00", now), null);
  assert.equal(periodText("2026-10-03T10:00:00+09:00", "2026-10-12T06:00:00+09:00"), "10.3 ~ 10.12");
  const notices = fixture("home-news.json").data.notices;
  assert.equal(maintenanceToday(notices, now)?.maintenanceDate, "2026-10-08");
  assert.equal(maintenanceToday(notices, Date.parse("2026-10-10T12:00:00+09:00")), null);
  assert.equal(
    nextOf([{ nextAt: "2026-10-08T22:00:00+09:00" }, { nextAt: "2026-10-08T23:00:00+09:00" }, { nextAt: null }], now),
    "2026-10-08T23:00:00+09:00",
  );
});

test("home requests validate input and pass through allow-listed errors", async () => {
  let calls = 0;
  const fetcher = (async (url: URL) => {
    calls++;
    if (url.pathname.endsWith("/news")) return Response.json(fixture("home-news.json"));
    assert.equal(url.searchParams.get("date"), "2026-10-09");
    return Response.json(fixture("home-schedule.json"));
  }) as unknown as typeof fetch;
  assert.equal((await requestSchedule("2026-10-09", origin, { fetcher })).ok, true);
  assert.equal((await requestSchedule("10월 9일", origin, { fetcher })).ok, false);
  assert.equal((await requestNews(8, origin, { fetcher })).ok, true);
  assert.equal((await requestNews(80, origin, { fetcher })).ok, false);
  assert.equal(calls, 2);
  const limited = await requestNews(8, origin, {
    fetcher: (async () => Response.json({ code: "HOME_CACHE_UNAVAILABLE" }, { status: 503 })) as typeof fetch,
  });
  assert.deepEqual(limited.ok ? null : limited.error, { code: "HOME_CACHE_UNAVAILABLE", status: 503 });
});

test("section status: next round today, or today over with the next day's first round", () => {
  const items = [
    { startTimes: ["2026-10-08T09:00:00+09:00", "2026-10-08T23:00:00+09:00"], nextAt: "2026-10-09T09:00:00+09:00" },
  ];
  const before = sectionStatus(items, Date.parse("2026-10-08T08:00:00+09:00"));
  assert.deepEqual(before, { state: "upcoming", next: "2026-10-08T09:00:00+09:00" });
  const after = Date.parse("2026-10-08T23:30:00+09:00");
  assert.deepEqual(sectionStatus(items, after), { state: "done", next: "2026-10-09T09:00:00+09:00" });
  assert.equal(dayLabel("2026-10-09T09:00:00+09:00", after), "내일");
  assert.equal(dayLabel("2026-10-12T09:00:00+09:00", after), "10.12");
  assert.equal(sectionStatus([{ startTimes: [], nextAt: null }], after).state, "none");
});

test("maintenance banner covers today and tomorrow; tomorrow only inside the week", () => {
  const notices = fixture("home-news.json").data.notices;
  const dayBefore = Date.parse("2026-10-07T20:00:00+09:00");
  assert.equal(upcomingMaintenance(notices, dayBefore)?.when, "tomorrow");
  assert.equal(upcomingMaintenance(notices, Date.parse("2026-10-08T09:00:00+09:00"))?.when, "today");
  assert.equal(upcomingMaintenance(notices, Date.parse("2026-10-10T09:00:00+09:00")), null);
  assert.equal(tomorrowInWeek("2026-10-13", Date.parse("2026-10-08T23:30:00+09:00")), "2026-10-09");
  assert.equal(tomorrowInWeek("2026-10-13", Date.parse("2026-10-13T23:30:00+09:00")), null);
});

test("patch notes are update/patch announcements, never maintenance", () => {
  const notice = (title: string, category: "NOTICE" | "MAINTENANCE" = "NOTICE") =>
    ({ title, category, publishedAt: "2026-10-09T00:00:00Z", url: null, maintenanceDate: null, maintenanceDateText: null });
  assert.equal(isPatchNote(notice("10월 8일(목) 클라이언트 패치 안내")), true);
  assert.equal(isPatchNote(notice("10월 7일(수) 업데이트 내역 안내")), true);
  assert.equal(isPatchNote(notice("알려진 이슈를 안내해 드립니다.")), false);
  assert.equal(isPatchNote(notice("10월 9일 업데이트 점검 안내", "MAINTENANCE")), false);
});

test("event posts that merely mention an update are not patch notes", () => {
  const notice = (title: string) =>
    ({ title, category: "NOTICE" as const, publishedAt: "2026-10-09T00:00:00Z", url: null, maintenanceDate: null, maintenanceDateText: null });
  assert.equal(isPatchNote(notice("익스트림 업데이트 기념 치지직 드롭스 스페셜 보상 당첨자를 발표합니다!")), false);
});
