// Roster tab list tools (checklist L17·L18): sort, compact view, hide names,
// and the six-man summary. Siblings come from the official roster API, which
// has item level and character level only; combat power columns and the
// combat-power six-man wait for the backend sibling fields (L19).

export const ROSTER_SORTS = [
  { id: "itemLevel", label: "아이템 레벨 순" },
  { id: "characterLevel", label: "캐릭터 레벨 순" },
  { id: "name", label: "이름 순" },
] as const;
export type RosterSort = (typeof ROSTER_SORTS)[number]["id"];

type Sibling = { characterName: string; characterLevel?: number | null; itemLevel?: number | null };

/** Highest first; ties keep the official order. Names in Korean order. */
export function sortSiblings<T extends Sibling>(siblings: readonly T[], sort: RosterSort): T[] {
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
 * 식스맨 평균: the mean item level of the roster's six highest characters
 * (fewer if the roster has fewer, said by `count`). 1,680+: how many
 * characters are at or above it and their item levels added up.
 */
export function rosterSummary(siblings: readonly Sibling[]) {
  const levels = siblings.map((s) => s.itemLevel).filter((v): v is number => v != null).sort((a, b) => b - a);
  const top = levels.slice(0, 6);
  const high = levels.filter((v) => v >= ROSTER_TOTAL_MIN);
  return {
    sixAverage: top.length ? Math.round((top.reduce((a, b) => a + b, 0) / top.length) * 100) / 100 : null,
    sixCount: top.length,
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
