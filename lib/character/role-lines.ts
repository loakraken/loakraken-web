// Which ark grid gem options and accessory polish lines count for a role (user
// via PM 총괄 10-26; lists from 레퍼런스 10-26): the character page shows a line
// that counts for this character's role in full colour and the rest in grey.
// Ark grid families are official (the guide's gem table); accessory lines follow
// the shipped search table (OPTIONS_BY) and two agreeing supporter guides, and
// utility lines count for neither role. White means "counts for this role",
// not "good roll": the 하/중/상 mark stays as it is.
import type { Position } from "@/lib/character/detail";

/** A line's name as compared: no spaces, no trailing 증가 (official text varies). */
const key = (name: string) => name.replace(/\s+/g, "").replace(/증가$/, "");

/** Ark grid gem options by family; anything else (포인트·의지력…) has no role split. */
const GRID: Record<string, Position> = {
  공격력: "DEALER",
  추가피해: "DEALER",
  보스피해: "DEALER",
  낙인력: "SUPPORT",
  아군피해강화: "SUPPORT",
  아군공격강화: "SUPPORT",
};

type Counts = readonly Position[];
const DEALER: Counts = ["DEALER"];
const SUPPORT: Counts = ["SUPPORT"];
const BOTH: Counts = ["DEALER", "SUPPORT"];
const NONE: Counts = [];

/** Accessory polish lines. 공격력 and 무기 공격력 differ by % (percent) vs flat. */
const PERCENT: Record<string, Counts> = {
  추가피해: DEALER,
  적에게주는피해: DEALER,
  낙인력: SUPPORT,
  "세레나데,신앙,조화게이지획득량": SUPPORT,
  공격력: DEALER,
  무기공격력: BOTH,
  치명타적중률: DEALER,
  치명타피해: DEALER,
  아군공격력강화효과: SUPPORT,
  아군피해량강화효과: SUPPORT,
  파티원회복효과: NONE,
  파티원보호막효과: NONE,
  상태이상공격지속시간: NONE,
};
const FLAT: Record<string, Counts> = {
  공격력: DEALER,
  무기공격력: DEALER,
  최대생명력: NONE,
  최대마나: NONE,
  전투중생명력회복량: NONE,
};

/**
 * Whether an ark grid gem option counts for the role: true or false, or null
 * when nothing is decided (no role, or an option without a role family).
 */
export function gridOptionCounts(name: string, role: Position | null): boolean | null {
  const family = GRID[key(name)];
  return role && family ? family === role : null;
}

/**
 * Whether an accessory polish line counts for the role: true or false, or
 * null when nothing is decided (no role, or a line not in the lists).
 */
export function accessoryLineCounts(name: string, value: string, role: Position | null): boolean | null {
  if (!role) return null;
  const counts = (value.includes("%") ? PERCENT : FLAT)[key(name)];
  return counts ? counts.includes(role) : null;
}
