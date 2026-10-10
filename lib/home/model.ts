// Home dashboard (B-4): today's schedule and official news, laid out the way
// LOAWA's home shows them (weekday tabs, countdowns, notices, events).
import type { components } from "../api/home-schema";
import { labelOf } from "../api/tolerant";
import { remainingText } from "../time/remaining";

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
export type RewardGroup = Schemas["HomeRewardGroupResponse"];
export type Reward = Schemas["HomeRewardResponse"];
export type PatchNotesEnvelope = Schemas["ApiResponseHomePatchNotesResponse"];
export type PatchNotes = Schemas["HomePatchNotesResponse"];
export type PatchNotice = Schemas["HomePatchNoticeResponse"];
export type PatchCategory = NonNullable<PatchNotice["category"]>;

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

/** Patch history kinds (backend patch-notice-v1 title rules). */
export const PATCH_LABEL: Record<PatchCategory, string> = {
  UPDATE: "업데이트",
  BALANCE: "밸런스",
  CLIENT_PATCH: "클라이언트 패치",
  MAINTENANCE_COMPLETE: "점검 완료",
};
export const PATCH_CATEGORIES = Object.keys(PATCH_LABEL) as PatchCategory[];
export const isPatchCategory = (value: string | null | undefined): value is PatchCategory =>
  !!value && Object.hasOwn(PATCH_LABEL, value);
export const patchLabel = (category: string) => labelOf(PATCH_LABEL, category);

/** Labels that fall back for a kind or category this build does not know yet. */
export const rewardLabel = (kind: string) => labelOf(REWARD_LABEL, kind);
export const noticeLabel = (category: string | null) =>
  category == null ? "공지" : labelOf(NOTICE_LABEL, category);

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

/** Time left until `iso` in the shared format, or null once it has passed. */
export function countdown(iso: string | null | undefined, now = Date.now()) {
  return iso ? remainingText(Date.parse(iso) - now) : null;
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

/** Maintenance notice for today or tomorrow (KST), today first. */
export function upcomingMaintenance(notices: Notice[], now = Date.now()) {
  const today = kstDate(now);
  const tomorrow = kstDate(now + DAY);
  const pick = (date: string) => notices.find((notice) => notice.maintenanceDate === date);
  const todayNotice = pick(today);
  if (todayNotice) return { notice: todayNotice, when: "today" as const };
  const tomorrowNotice = pick(tomorrow);
  return tomorrowNotice ? { notice: tomorrowNotice, when: "tomorrow" as const } : null;
}

/** Tomorrow's KST date if it is still inside the covered week. */
export function tomorrowInWeek(coveredTo: string | null, now = Date.now()) {
  const tomorrow = kstDate(now + DAY);
  return coveredTo && tomorrow <= coveredTo ? tomorrow : null;
}

/** Patch notes (update/patch announcements) shown apart from other notices (KLOA). */
export function isPatchNote(notice: Notice) {
  return (
    notice.category !== "MAINTENANCE" &&
    /업데이트 내역|패치 안내|패치 노트|패치노트/.test(notice.title)
  );
}

const GRADE_RANK = ["고대", "유물", "전설", "영웅", "희귀", "고급", "일반"];
const gradeRank = (grade: string | null) => {
  const i = GRADE_RANK.indexOf(grade ?? "");
  return i < 0 ? GRADE_RANK.length : i;
};

/**
 * The rewards a schedule row shows inline (LOAWA shows a few icons per row):
 * every reward once by name, rewards tied to that day's rounds first, then by
 * grade. `rest` is how many more the expanded list holds.
 */
export function rewardSummary(groups: RewardGroup[], shown = 3) {
  const seen = new Map<string, Reward>();
  for (const group of groups)
    for (const reward of group.rewards) {
      const known = seen.get(reward.name);
      if (!known || (reward.timed && !known.timed)) seen.set(reward.name, reward);
    }
  const all = [...seen.values()].sort(
    (a, b) => Number(b.timed) - Number(a.timed) || gradeRank(a.grade) - gradeRank(b.grade),
  );
  return { top: all.slice(0, shown), rest: Math.max(0, all.length - shown) };
}

/** Item-level heading for a reward group; null when the group has no level. */
export function rewardGroupLabel(group: RewardGroup) {
  return group.minItemLevel != null && group.minItemLevel > 1
    ? `${group.minItemLevel.toLocaleString("ko-KR")} 이상`
    : null;
}
