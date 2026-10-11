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
 * "언새늘" → "언**": the first letter and a fixed two stars, so the length does
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
