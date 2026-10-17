// Roster tab list tools (checklist L17·L18): sort, compact view, hide names,
// and the six-man summary. Siblings come from the official roster API, which
// has item level and character level only; combat power comes from the
// records (L19, roster-power.ts) and is joined here by character name.
import type { RosterPower, RosterPowerRefresh } from "./roster-power";

export const ROSTER_SORTS = [
  { id: "combatPower", label: "전투력 순", short: "전투력" },
  { id: "itemLevel", label: "아이템 레벨 순", short: "아이템" },
  { id: "characterLevel", label: "캐릭터 레벨 순", short: "레벨" },
  { id: "name", label: "이름 순", short: "이름" },
] as const;
export type RosterSort = (typeof ROSTER_SORTS)[number]["id"];

type Sibling = { characterName: string; serverName?: string; characterLevel?: number | null; itemLevel?: number | null };

/** Highest first; ties keep the official order. Names in Korean order. */
export function sortSiblings<T extends Sibling>(
  siblings: readonly T[],
  sort: RosterSort,
  records: ReadonlyMap<string, PowerRecord> = new Map(),
): T[] {
  if (sort === "combatPower") return sortByPower(siblings, records);
  const list = [...siblings];
  if (sort === "name") return list.sort((a, b) => a.characterName.localeCompare(b.characterName, "ko"));
  const key = sort === "itemLevel" ? "itemLevel" : "characterLevel";
  return list.sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
}

/**
 * "목캐릭터A" → "목**": the first letter and a fixed two stars, so the length does
 * not give the name away and long names do not wrap.
 */
export const maskName = (name: string) => {
  const first = [...name][0];
  return first ? `${first}**` : "**";
};

/** Item level at or above which a character counts toward the roster total. */
export const ROSTER_TOTAL_MIN = 1680;

/**
 * 식스맨, the roster ranking's rule (api #530): the six highest item levels
 * on one server — the server of the roster's highest character, its
 * representative — ties by name. Fewer if that server has fewer.
 */
export function sixMen<T extends Sibling>(siblings: readonly T[]): T[] {
  const ranked = siblings
    .filter((s) => s.itemLevel != null)
    .sort((a, b) => b.itemLevel! - a.itemLevel! || a.characterName.localeCompare(b.characterName, "ko"));
  const server = ranked[0]?.serverName;
  return ranked.filter((s) => s.serverName === server).slice(0, 6);
}

/**
 * "아이템 레벨 상위 6명 평균", or with fewer "아이템 레벨 상위 3명 합 ÷ 6" (still
 * ÷ 6; a no-break space keeps "÷ 6" on one line).
 */
export const sixBasis = (count: number, word: "평균" | "기준") =>
  count >= 6 ? `아이템 레벨 상위 6명 ${word}` : `아이템 레벨 상위 ${count}명 합 ÷ 6`;

/**
 * 식스맨 평균: the six's item levels added up and always ÷ 6, as the ranking
 * does (fewer than six still ÷ 6; `sixCount` says how many). 1,680+: how many
 * characters of the whole roster are at or above it and their item levels
 * added up.
 */
export function rosterSummary(siblings: readonly Sibling[]) {
  const six = sixMen(siblings);
  const high = siblings.map((s) => s.itemLevel).filter((v): v is number => v != null && v >= ROSTER_TOTAL_MIN);
  return {
    sixAverage: six.length ? Math.round((six.reduce((a, s) => a + s.itemLevel!, 0) / 6) * 100) / 100 : null,
    sixCount: six.length,
    sixServer: six[0]?.serverName ?? null,
    highCount: high.length,
    highSum: Math.round(high.reduce((a, b) => a + b, 0) * 100) / 100,
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The roster in numbers (character screen checklist §14.1 ②): how many
 * characters, and their item levels' mean, median, highest and lowest.
 */
export function rosterStats(siblings: readonly Sibling[]) {
  const levels = siblings
    .map((s) => s.itemLevel)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (!levels.length) return { count: siblings.length, average: null, median: null, max: null, min: null };
  const mid = Math.floor(levels.length / 2);
  const median = levels.length % 2 ? levels[mid] : (levels[mid - 1] + levels[mid]) / 2;
  return {
    count: siblings.length,
    average: round2(levels.reduce((a, b) => a + b, 0) / levels.length),
    median: round2(median),
    max: levels.at(-1)!,
    min: levels[0],
  };
}

export type Share = { label: string; count: number; percent: number };

/**
 * Counts as shares of the whole with one decimal that add up to exactly
 * 100.0 (largest remainder), biggest first, ties in the given order.
 */
export function shares(groups: readonly { label: string; count: number }[]): Share[] {
  const total = groups.reduce((a, g) => a + g.count, 0);
  if (!total) return [];
  const raw = groups.map((g, i) => ({ ...g, i, tenths: (g.count / total) * 1000 }));
  const floors = raw.map((g) => ({ ...g, whole: Math.floor(g.tenths) }));
  let left = 1000 - floors.reduce((a, g) => a + g.whole, 0);
  for (const g of [...floors].sort((a, b) => b.tenths - b.whole - (a.tenths - a.whole) || a.i - b.i)) {
    if (left <= 0) break;
    g.whole += 1;
    left -= 1;
  }
  return floors
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map((g) => ({ label: g.label, count: g.count, percent: g.whole / 10 }));
}

/** Item level bands, 20 apart from 1780+ down to "1640 미만", only bands with someone in them. */
export const LEVEL_BANDS = [1780, 1760, 1740, 1720, 1700, 1680, 1660, 1640] as const;

export function levelBands(siblings: readonly Sibling[]): Share[] {
  const groups = [
    ...LEVEL_BANDS.map((min, i) => ({
      label: i === 0 ? `${min}+` : String(min),
      count: siblings.filter((s) => s.itemLevel != null && s.itemLevel >= min && (i === 0 || s.itemLevel < LEVEL_BANDS[i - 1])).length,
    })),
    { label: "1640 미만", count: siblings.filter((s) => s.itemLevel != null && s.itemLevel < 1640).length },
  ];
  // Bands keep their own order (high to low), not biggest first.
  const order = new Map(groups.map((g, i) => [g.label, i]));
  return shares(groups).sort((a, b) => order.get(a.label)! - order.get(b.label)!);
}

/** Classes in the roster, biggest first. */
export function classMix(siblings: readonly (Sibling & { className: string })[]): Share[] {
  const counts = new Map<string, number>();
  for (const s of siblings) counts.set(s.className, (counts.get(s.className) ?? 0) + 1);
  return shares([...counts].map(([label, count]) => ({ label, count })));
}

/** The refill's items as the view the list reads (missing count from the items). */
export function viewOfRefresh(refresh: RosterPowerRefresh): RosterPower {
  return {
    items: refresh.items,
    missingCount: refresh.items.filter((item) => item.combatPower == null).length,
    refreshAvailableAt: refresh.refreshAvailableAt,
  };
}

/** bestCombatPower: the highest combat power LOAKraken has seen (the character ranking's value), null when none. */
export type PowerRecord = { combatPower: number | null; observedAt: string | null; bestCombatPower: number | null };

/** Records by character name (the roster list and this response name the same characters). */
export function powerByName(power: RosterPower): Map<string, PowerRecord> {
  return new Map(
    power.items.map((item) => [
      item.characterName,
      {
        combatPower: item.combatPower ?? null,
        observedAt: item.combatPowerObservedAt ?? null,
        bestCombatPower: item.bestCombatPower ?? null,
      },
    ]),
  );
}

/**
 * Combat power, highest first; characters without a record go to the bottom
 * (in item level order), ties keep the given order.
 */
export function sortByPower<T extends { characterName: string; itemLevel?: number | null }>(
  siblings: readonly T[],
  records: ReadonlyMap<string, PowerRecord>,
): T[] {
  const power = (s: T) => records.get(s.characterName)?.combatPower ?? null;
  return [...siblings].sort((a, b) => {
    const pa = power(a);
    const pb = power(b);
    if (pa == null || pb == null) {
      if (pa != null) return -1;
      if (pb != null) return 1;
      return (b.itemLevel ?? 0) - (a.itemLevel ?? 0);
    }
    return pb - pa;
  });
}

/** Item level from which a 식스맨 without a combat power record leaves the mean unknown (as the ranking leaves the roster out). */
export const SIX_POWER_MIN = 1640;

/**
 * 식스맨 by combat power, the ranking's rule (api #530): the same six as the
 * item level 식스맨 (sixMen), their recorded values added up and always ÷ 6.
 * One of them at 1,640+ without a record leaves it unknown (`sixMissing` of
 * them) — the ranking leaves such a roster out — rather than a lower guess.
 * The total adds up every recorded value; `recorded` of `count` says how many.
 */
export function powerSummary(siblings: readonly Sibling[], records: ReadonlyMap<string, PowerRecord>) {
  const valueOf = (s: Sibling) => records.get(s.characterName)?.combatPower ?? null;
  const values = siblings.map(valueOf).filter((v): v is number => v != null);
  const six = sixMen(siblings);
  const sixValues = six.map(valueOf).filter((v): v is number => v != null);
  const sixMissing = six.filter((s) => valueOf(s) == null && s.itemLevel! >= SIX_POWER_MIN).length;
  return {
    count: siblings.length,
    recorded: values.length,
    sixAverage: sixValues.length && !sixMissing ? round2(sixValues.reduce((a, b) => a + b, 0) / 6) : null,
    sixCount: six.length,
    sixMissing,
    total: values.length ? round2(values.reduce((a, b) => a + b, 0)) : null,
  };
}
