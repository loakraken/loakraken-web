// Home dashboard (B-4): today's schedule and official news, laid out the way
// LOAWA's home shows them (weekday tabs, countdowns, notices, events).
import type { components } from "../api/home-schema";

type Schemas = components["schemas"];
export type ScheduleEnvelope = Schemas["ApiResponseHomeScheduleResponse"];
export type NewsEnvelope = Schemas["ApiResponseHomeNewsResponse"];
export type Schedule = Schemas["HomeScheduleResponse"];
export type Island = Schemas["HomeIslandResponse"];
export type Timed = Schemas["HomeTimedResponse"];
export type Other = Schemas["HomeOtherResponse"];
export type Notice = Schemas["HomeNoticeResponse"];
export type HomeEvent = Schemas["HomeEventResponse"];
export type RewardKind = Island["rewardKinds"][number];

export const REWARD_LABEL: Record<RewardKind, string> = {
  GOLD: "골드",
  CARD_PACK: "카드",
  SILLING: "실링",
  PIRATE_COIN: "주화",
};

export const NOTICE_LABEL: Record<NonNullable<Notice["category"]>, string> = {
  NOTICE: "공지",
  MAINTENANCE: "점검",
  EVENT: "이벤트",
  SHOP: "상점",
};

const DAY = 86_400_000;
const KST = 9 * 3_600_000;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** YYYY-MM-DD in KST. */
export function kstDate(now = Date.now()) {
  return new Date(now + KST).toISOString().slice(0, 10);
}

export function isDate(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

/** Every date of the covered week (Wednesday → Tuesday), with weekday labels. */
export function weekDays(from: string | null, to: string | null) {
  const days: { date: string; day: number; weekday: string }[] = [];
  if (!isDate(from) || !isDate(to)) return days;
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY) {
    const date = new Date(t);
    days.push({
      date: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      weekday: WEEKDAY[date.getUTCDay()],
    });
  }
  return days;
}

/** "HH:mm" in KST for an ISO time. */
export function kstTime(iso: string) {
  return new Date(Date.parse(iso) + KST).toISOString().slice(11, 16);
}

/** "29분 43초" / "1시간 5분" until the time, or null once it has passed. */
export function countdown(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  const left = Math.floor((Date.parse(iso) - now) / 1000);
  if (!Number.isFinite(left) || left < 0) return null;
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분 ${s}초`;
}

/** Days left until an event ends, by KST calendar date ("D-4", "D-day"). */
export function dDay(endAt: string | null, now = Date.now()) {
  if (!endAt) return null;
  const days = Math.round(
    (Date.parse(`${kstDate(Date.parse(endAt))}T00:00:00Z`) - Date.parse(`${kstDate(now)}T00:00:00Z`)) / DAY,
  );
  if (days < 0) return null;
  return days === 0 ? "D-day" : `D-${days}`;
}

/** "10.3 ~ 10.12" in KST. */
export function periodText(startAt: string | null, endAt: string | null) {
  const short = (iso: string | null) => {
    if (!iso) return "";
    const [, m, d] = kstDate(Date.parse(iso)).split("-");
    return `${Number(m)}.${Number(d)}`;
  };
  return endAt ? `${short(startAt)} ~ ${short(endAt)}` : `${short(startAt)} ~`;
}

/** Today's maintenance notice, if any: the banner shows only on the day itself. */
export function maintenanceToday(notices: Notice[], now = Date.now()) {
  const today = kstDate(now);
  return notices.find((notice) => notice.maintenanceDate === today) ?? null;
}

/** Earliest upcoming time across a section (for the section countdown). */
export function nextOf(items: { nextAt: string | null }[], now = Date.now()) {
  return (
    items
      .map((item) => item.nextAt)
      .filter((at): at is string => !!at && Date.parse(at) >= now)
      .sort()[0] ?? null
  );
}

/**
 * A section's state for its header: the next round today, or — once every
 * round today has passed — that today is over and when the next one is.
 */
export function sectionStatus(
  items: { startTimes: string[]; nextAt: string | null }[],
  now = Date.now(),
) {
  const today = items.flatMap((item) => item.startTimes).filter((at) => Date.parse(at) > now).sort();
  if (today.length) return { state: "upcoming" as const, next: today[0] };
  const hadRounds = items.some((item) => item.startTimes.length > 0);
  return { state: hadRounds ? ("done" as const) : ("none" as const), next: nextOf(items, now) };
}

/** "내일" / "10.12" for a time that is not today (KST). */
export function dayLabel(iso: string, now = Date.now()) {
  const date = kstDate(Date.parse(iso));
  if (date === kstDate(now)) return "오늘";
  if (date === kstDate(now + DAY)) return "내일";
  const [, m, d] = date.split("-");
  return `${Number(m)}.${Number(d)}`;
}
