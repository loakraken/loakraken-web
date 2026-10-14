// 대세 빌드 비교 (checklist M26): one character's setting next to its class's
// (and class engraving's) most chosen ones. The class side is the class builds
// statistics as they are; "mine" is the cells the backend counts this
// character in (api #498, builds/character: the same rules and keys as the
// statistics, class-builds-v1). No combat power numbers: nothing here is a
// calculation, only which setting is the same.
import { classBuildsPath, type ClassBuildCells, type ClassBuildCellsResult, type ClassBuilds } from "./class-builds";

/** The character to compare, from the page address: a game name (letters and digits, 1~16), else none. */
export function parseCompareCharacter(value: string | null | undefined) {
  const name = value?.trim().normalize("NFC") ?? "";
  return name.length >= 1 && name.length <= 16 && /^[\p{L}\p{N}]+$/u.test(name) ? name : null;
}

/** The class page in comparison mode: the character's class (and class engraving) with the character. */
export function buildComparePath(className: string, classEngraving: string | null | undefined, character: string) {
  const path = classBuildsPath(className, { classEngraving: classEngraving ?? undefined });
  return `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams({ character })}`;
}

// --- Why a character is outside the sample ---------------------------------------

/**
 * The reasons the backend gives for a character outside the statistics'
 * conditions, in words; null when it is inside. OTHER_CLASS is not here: that
 * one compares nothing (see the component). Reasons are strings and may grow:
 * one not known here reads as the conditions in general.
 */
export function outsideSample(result: Pick<ClassBuildCellsResult, "inSample" | "reasons" | "conditions" | "itemLevel">) {
  if (result.inSample) return null;
  const { itemLevelMin, itemLevelMax, activeDays } = result.conditions;
  const level = (value: number | string) => Number(value).toLocaleString("ko-KR");
  const above = itemLevelMax != null && Number(result.itemLevel) > Number(itemLevelMax);
  const words = [
    ...new Set(
      result.reasons
        .filter((reason) => reason !== "OTHER_CLASS")
        .map((reason) =>
          reason === "ITEM_LEVEL_OUT_OF_RANGE"
            ? above
              ? `아이템 레벨 ${level(itemLevelMax!)} 초과`
              : `아이템 레벨 ${level(itemLevelMin)} 미만`
            : reason === "NOT_RECENT"
              ? `최근 ${activeDays}일 안에 확인되지 않음`
              : reason === "NO_COMBAT_POWER"
                ? "전투력 확인 없음"
                : "통계 조건 밖",
        ),
    ),
  ];
  return words.length ? `이 캐릭터는 표본에 들지 않아요(${words.join(" · ")}).` : null;
}

// --- One section side by side ---------------------------------------------------

export type CompareRow = { label: string; share: number | null; count: number; mine: boolean };
export type CompareSection = {
  id: string;
  title: string;
  /** The first three as the statistics rank them, with mine marked. */
  top: CompareRow[];
  /** The rest of the list: how many more and, where one character is one cell, their share. */
  others: { cells: number; share: number | null; hiddenSmall: boolean } | null;
  /** In words, not colour: where mine stands — short, one line. */
  verdict: string;
  /** Mine in full ("내 세팅: …"), one line on screen (cut with an ellipsis, whole in its title); null when there is nothing to add. */
  mine: string | null;
  /** Mine is not the most chosen (or lacks one of the top rows, for several-per-character items). */
  differs: boolean;
};

const UNREAD = "내 세팅을 읽지 못해 비교하지 않았어요";

type Cell<K> = { key: K; label: string; count: number; share: number | null };

const round1 = (value: number) => Math.round(value * 10) / 10;

/** One setting per character: the share of the rest is 100 minus the first three. */
function single<K>(
  id: string,
  title: string,
  cells: Cell<K>[],
  hiddenCount: number,
  mine: K | null,
  same: (a: K, b: K) => boolean,
  mineLabel: (value: K) => string,
): CompareSection {
  const rank = mine == null ? -1 : cells.findIndex((cell) => same(cell.key, mine));
  const top = cells.slice(0, 3).map((cell, i) => ({ label: cell.label, share: cell.share, count: cell.count, mine: i === rank }));
  const topShare = top.reduce((sum, row) => sum + (row.share ?? 0), 0);
  const rest = cells.length - top.length;
  const others =
    rest > 0 || hiddenCount > 0 ? { cells: rest, share: round1(Math.max(0, 100 - topShare)), hiddenSmall: hiddenCount > 0 } : null;
  if (mine == null) return { id, title, top, others, verdict: UNREAD, mine: null, differs: false };
  const verdict =
    rank === 0
      ? "대세와 같아요"
      : rank > 0
        ? `대세와 달라요 · 내 세팅은 ${rank + 1}위`
        : `대세와 달라요 · 내 세팅은 목록 밖${hiddenCount > 0 ? "(인원이 적은 칸일 수 있음)" : ""}`;
  return { id, title, top, others, verdict, mine: `내 세팅: ${mineLabel(mine)}`, differs: rank !== 0 };
}

/** Share (%) at or above which a line is part of the most chosen setting, for several-per-character items. */
export const MAJORITY = 50;

/**
 * Several per character (engravings, bracelet stats). The most chosen
 * setting is every line at least half the sample has (no fixed count, PM
 * 총괄 10-14): same when I have them all, different when one is missing;
 * my lines beyond them are shown as "추가" and do not count as different.
 * No line reaching half: no clear most chosen setting, no same/different.
 */
function several(id: string, title: string, cells: Cell<string>[], mine: string[] | null, unread = UNREAD): CompareSection {
  const have = new Set(mine ?? []);
  const top = cells.slice(0, 3).map((cell) => ({ label: cell.label, share: cell.share, count: cell.count, mine: have.has(cell.key) }));
  const rest = cells.length - top.length;
  const others = rest > 0 ? { cells: rest, share: null, hiddenSmall: false } : null;
  if (mine == null) return { id, title, top, others, verdict: unread, mine: null, differs: false };
  const majority = cells.filter((cell) => cell.share != null && cell.share >= MAJORITY);
  const extra = [...have].filter((name) => !majority.some((cell) => cell.key === name));
  if (!majority.length)
    return { id, title, top, others, verdict: "뚜렷한 대세 없음", mine: have.size ? `내 세팅: ${[...have].join("·")}` : null, differs: false };
  const missing = majority.filter((cell) => !have.has(cell.key)).map((cell) => cell.label);
  return {
    id,
    title,
    top,
    others,
    verdict: missing.length ? `대세와 달라요 · 과반이 쓰는 ${missing.join("·")} 없음` : "대세와 같아요",
    mine: extra.length ? `추가: ${extra.join("·")}` : null,
    differs: missing.length > 0,
  };
}

/** Gems by effect kind, counted per gem (tier 4 only, by the backend): which levels I have and how many. */
function gemSection(id: string, title: string, cells: Cell<number>[], mine: number[] | null): CompareSection {
  const byLevel = new Map<number, number>();
  for (const level of mine ?? []) byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
  const top = cells.slice(0, 3).map((cell) => ({ label: cell.label, share: cell.share, count: cell.count, mine: byLevel.has(cell.key) }));
  const rest = cells.length - top.length;
  const others = rest > 0 ? { cells: rest, share: null, hiddenSmall: false } : null;
  if (mine == null) return { id, title, top, others, verdict: "내 보석을 읽지 못해 비교하지 않았어요", mine: null, differs: false };
  const mineText = [...byLevel.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([level, count]) => `${level}레벨 ${count}개`)
    .join("·");
  const most = cells[0]?.key;
  const hasMost = most != null && byLevel.has(most);
  return {
    id,
    title,
    top,
    others,
    verdict: most == null ? "비교할 레벨이 없어요" : hasMost ? `가장 많은 ${most}레벨이 있어요` : `대세와 달라요 · 가장 많은 ${most}레벨이 없음`,
    mine: mineText ? `내 보석: ${mineText}` : "내 보석: 이 효과의 4티어 보석 없음",
    differs: most != null && !hasMost,
  };
}

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((name, i) => name === b[i]);
const cardLabel = (card: { set: string; pieces: number | null; awakening?: number | null }) =>
  `${card.set} ${card.pieces}세트${card.awakening ? ` ${card.awakening}각성` : ""}`;

/**
 * Every section the class statistics have, in their order, with my cells
 * beside them (null: not read, nothing compared). The bracelet is compared
 * only from the statistics' bracelet item level on, as it is counted.
 */
export function compareBuild(
  builds: ClassBuilds,
  mine: ClassBuildCells | null,
  braceletItemLevelMin?: number | string | null,
): CompareSection[] {
  const name = (section: { cells: { name: string; count: number; share?: number | null }[] } | null | undefined): Cell<string>[] =>
    (section?.cells ?? []).map((cell) => ({ key: cell.name, label: cell.name, count: cell.count, share: cell.share ?? null }));
  const value = (section: { cells: { value: number; count: number; share?: number | null }[] } | null | undefined, unit: string): Cell<number>[] =>
    (section?.cells ?? []).map((cell) => ({ key: cell.value, label: `${cell.value}${unit}`, count: cell.count, share: cell.share ?? null }));
  const ap = builds.arkPassivePoints;
  const point = (id: string, title: string, key: "evolution" | "enlightenment" | "leap") =>
    single(id, title, value(ap?.[key], ""), ap?.[key]?.hidden?.count ?? 0, mine?.arkPassivePoints?.[key]?.value ?? null, (a, b) => a === b, String);
  const card = mine?.cardSets;
  const top = mine?.topStats;
  const braceletLevel = braceletItemLevelMin ?? builds.braceletItemLevelMin;
  return [
    single(
      "combo",
      "각인 조합",
      (builds.engravingCombos?.cells ?? []).map((cell) => ({
        key: [...cell.engravings].sort(byName),
        label: cell.engravings.join(" · "),
        count: cell.count,
        share: cell.share ?? null,
      })),
      builds.engravingCombos?.hidden?.count ?? 0,
      mine?.engravingCombos ? [...mine.engravingCombos.engravings].sort(byName) : null,
      sameList,
      (combo) => combo.join(" · "),
    ),
    several("engravings", "각인 채용", name(builds.engravings), mine?.engravings?.map((cell) => cell.name) ?? null),
    point("evolution", "아크 패시브 진화", "evolution"),
    point("enlightenment", "아크 패시브 깨달음", "enlightenment"),
    point("leap", "아크 패시브 도약", "leap"),
    gemSection("damage", "피해 증가 보석", value(builds.gems?.damage, "레벨"), mine?.gems?.damage?.map((cell) => cell.value) ?? null),
    gemSection("cooldown", "재사용 대기시간 감소 보석", value(builds.gems?.cooldown, "레벨"), mine?.gems?.cooldown?.map((cell) => cell.value) ?? null),
    single(
      "cards",
      "카드 세트",
      (builds.cardSets?.cells ?? []).map((cell) => ({
        key: { set: cell.set, pieces: cell.pieces, awakening: cell.awakening ?? 0 },
        label: cardLabel(cell),
        count: cell.count,
        share: cell.share ?? null,
      })),
      builds.cardSets?.hidden?.count ?? 0,
      card ? { set: card.set, pieces: card.pieces, awakening: card.awakening ?? 0 } : null,
      (a, b) => a.set === b.set && a.pieces === b.pieces && a.awakening === b.awakening,
      cardLabel,
    ),
    single(
      "topStat",
      "주력 전투 특성",
      name(builds.topStats),
      builds.topStats?.hidden?.count ?? 0,
      top?.name ?? null,
      (a, b) => a === b,
      // A tie is counted to the earlier stat of the fixed order, as the statistics count it.
      (stat) => (top?.tie ? `${stat} (같은 값이 있어 앞 순서로 셈)` : stat),
    ),
    several(
      "bracelet",
      "팔찌 전투 특성",
      name(builds.braceletStats),
      mine?.braceletStats?.map((cell) => cell.name) ?? null,
      mine && !mine.braceletEligible
        ? `아이템 레벨 ${Number(braceletLevel ?? 1680).toLocaleString("ko-KR")} 미만이라 비교하지 않았어요`
        : UNREAD,
    ),
  ];
}
