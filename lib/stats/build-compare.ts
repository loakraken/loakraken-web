// 대세 빌드 비교 (checklist M26 stage 1): one character's setting next to its
// class's (and class engraving's) most chosen ones. The class side is the
// class builds statistics as they are; "mine" is read from the character with
// the very rules the backend uses to count it (equipment summary and class
// builds, class-builds-v1): engraving name sets, tier 4 gems by effect kind,
// the largest card set, the top combat stat with its fixed tie order and the
// bracelet's "stat +n" lines. No combat power numbers: nothing here is a
// calculation, only which setting is the same.
import type { Character } from "@/lib/character/model";
import { classBuildsPath, type ClassBuilds } from "./class-builds";

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

/** The six combat stats; on equal values the earlier one is the top stat. */
export const COMBAT_STATS = ["치명", "특화", "신속", "제압", "인내", "숙련"] as const;
const GEM_KINDS = new Set(["겁화", "작열", "광휘"]);
const GEM_KIND = /(겁화|작열|광휘|멸화|홍염)의 보석/;
const CARD_SET = /^(.+?)\s+(\d+)세트(?:\s*\((\d+)각성합계\))?$/;
const BRACELET_STAT = /^(치명|특화|신속|제압|인내|숙련) \+\d+$/;

export type GemMode = "DAMAGE" | "COOLDOWN";
export type MyGem = { kind: string | null; level: number | null; mode: GemMode | null };
export type MyCardSet = { set: string; pieces: number; awakening: number };
export type MyBuild = {
  classEngraving: string | null;
  /** Engraving names, sorted, without blanks; null when unread or empty. */
  combo: string[] | null;
  points: { evolution: number | null; enlightenment: number | null; leap: number | null } | null;
  gems: MyGem[] | null;
  cardSet: MyCardSet | null;
  topStat: (typeof COMBAT_STATS)[number] | null;
  /** Stats on the bracelet; null when no bracelet was read, empty when it has none. */
  braceletStats: string[] | null;
};

/** The first number of a value, commas removed ("1,234" → 1234), as the backend reads stats. */
const firstNumber = (value: string | null | undefined) => {
  const found = value?.replace(/,/g, "").match(/\d+/);
  return found ? Number(found[0]) : null;
};

export function myBuild(character: Character): MyBuild {
  const { loadout } = character;
  const passive = loadout.arkPassive;

  const names = loadout.engravings
    ? [...new Set(loadout.engravings.arkPassiveEffects.map((e) => e?.name).filter((n): n is string => !!n && n.trim() !== ""))].sort(
        (a, b) => (a < b ? -1 : a > b ? 1 : 0),
      )
    : null;

  let points: MyBuild["points"] = null;
  if (passive) {
    points = { evolution: null, enlightenment: null, leap: null };
    for (const point of passive.points) {
      if (point?.name === "진화") points.evolution = point.value;
      else if (point?.name === "깨달음") points.enlightenment = point.value;
      else if (point?.name === "도약") points.leap = point.value;
    }
  }

  let gems: MyGem[] | null = null;
  if (loadout.gems) {
    const skills = loadout.gems.effects?.skills ?? [];
    const mode = (slot: number | null): GemMode | null => {
      for (const skill of skills) {
        if (!skill || skill.gemSlot !== slot) continue;
        for (const line of skill.description) {
          if (line == null) continue;
          if (line.includes("재사용 대기시간")) return "COOLDOWN";
          if (line.includes("피해")) return "DAMAGE";
        }
      }
      return null;
    };
    gems = loadout.gems.items
      .filter((gem) => gem?.name != null)
      .sort((a, b) => (a.slot ?? Infinity) - (b.slot ?? Infinity))
      .map((gem) => ({ kind: gem.name?.match(GEM_KIND)?.[1] ?? null, level: gem.level, mode: mode(gem.slot) }));
  }

  let cardSet: MyCardSet | null = null;
  if (loadout.cards) {
    let set: string | null = null;
    let pieces = 0;
    let awakening = 0;
    for (const group of loadout.cards.effects) {
      for (const effect of group?.items ?? []) {
        const found = effect?.name?.trim().match(CARD_SET);
        if (!found) continue;
        const effectPieces = Number(found[2]);
        const effectAwakening = found[3] == null ? 0 : Number(found[3]);
        if (effectPieces > pieces) {
          set = found[1];
          pieces = effectPieces;
          awakening = effectAwakening;
        } else if (effectPieces === pieces && set === found[1]) awakening = Math.max(awakening, effectAwakening);
      }
    }
    cardSet = set == null ? null : { set, pieces, awakening };
  }

  const statValues = COMBAT_STATS.map((type) => firstNumber(character.stats.find((stat) => stat.type === type)?.value));
  let topStat: MyBuild["topStat"] = null;
  if (!statValues.includes(null)) {
    let best = 0;
    for (let i = 1; i < statValues.length; i++) if (statValues[i]! > statValues[best]!) best = i;
    topStat = COMBAT_STATS[best];
  }

  const bracelet = loadout.equipment.find((item) => item?.type === "팔찌");
  const braceletStats = bracelet?.detail
    ? bracelet.detail.braceletEffects
        .flatMap((effect) => (effect?.text ?? "").split("\n"))
        .map((line) => line.trim().match(BRACELET_STAT)?.[1])
        .filter((stat): stat is string => !!stat)
    : null;

  return {
    classEngraving: passive?.title ?? null,
    combo: names && names.length ? names : null,
    points,
    gems,
    cardSet,
    topStat,
    braceletStats,
  };
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

/** Several per character (engravings, bracelet stats): which of the most chosen I have, and mine not among them. */
function several(id: string, title: string, cells: Cell<string>[], mine: string[] | null, unit: string): CompareSection {
  const have = new Set(mine ?? []);
  const top = cells.slice(0, 3).map((cell) => ({ label: cell.label, share: cell.share, count: cell.count, mine: have.has(cell.key) }));
  const rest = cells.length - top.length;
  const others = rest > 0 ? { cells: rest, share: null, hiddenSmall: false } : null;
  if (mine == null) return { id, title, top, others, verdict: UNREAD, mine: null, differs: false };
  const missing = top.filter((row) => !row.mine).map((row) => row.label);
  const listed = new Set(cells.map((cell) => cell.key));
  const outside = [...have].filter((name) => !listed.has(name));
  return {
    id,
    title,
    top,
    others,
    verdict: missing.length ? `대세와 달라요 · ${missing.join("·")} 없음` : `많이 쓰는 ${unit} ${top.length}개를 모두 써요`,
    mine: outside.length ? `목록에 없는 내 ${unit}: ${outside.join("·")}` : null,
    differs: missing.length > 0,
  };
}

/** Gems by effect kind, counted per gem: which levels I have and how many. */
function gemSection(id: string, title: string, cells: Cell<number>[], mine: MyGem[] | null, mode: GemMode): CompareSection {
  const mineLevels = (mine ?? [])
    .filter((gem) => gem.mode === mode && gem.kind != null && GEM_KINDS.has(gem.kind) && gem.level != null)
    .map((gem) => gem.level as number);
  const byLevel = new Map<number, number>();
  for (const level of mineLevels) byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
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

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((name, i) => name === b[i]);
const cardLabel = (card: { set: string; pieces: number | null; awakening?: number | null }) =>
  `${card.set} ${card.pieces}세트${card.awakening ? ` ${card.awakening}각성` : ""}`;

/** Every section the class statistics have, in their order, with mine beside them. */
export function compareBuild(builds: ClassBuilds, mine: MyBuild): CompareSection[] {
  const name = (section: { cells: { name: string; count: number; share?: number | null }[] } | null | undefined): Cell<string>[] =>
    (section?.cells ?? []).map((cell) => ({ key: cell.name, label: cell.name, count: cell.count, share: cell.share ?? null }));
  const value = (section: { cells: { value: number; count: number; share?: number | null }[] } | null | undefined, unit: string): Cell<number>[] =>
    (section?.cells ?? []).map((cell) => ({ key: cell.value, label: `${cell.value}${unit}`, count: cell.count, share: cell.share ?? null }));
  const ap = builds.arkPassivePoints;
  const point = (id: string, title: string, key: "evolution" | "enlightenment" | "leap") =>
    single(id, title, value(ap?.[key], ""), ap?.[key]?.hidden?.count ?? 0, mine.points?.[key] ?? null, (a, b) => a === b, String);
  return [
    single(
      "combo",
      "각인 조합",
      (builds.engravingCombos?.cells ?? []).map((cell) => ({
        key: [...cell.engravings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
        label: cell.engravings.join(" · "),
        count: cell.count,
        share: cell.share ?? null,
      })),
      builds.engravingCombos?.hidden?.count ?? 0,
      mine.combo,
      sameList,
      (combo) => combo.join(" · "),
    ),
    several("engravings", "각인 채용", name(builds.engravings), mine.combo, "각인"),
    point("evolution", "아크 패시브 진화", "evolution"),
    point("enlightenment", "아크 패시브 깨달음", "enlightenment"),
    point("leap", "아크 패시브 도약", "leap"),
    gemSection("damage", "피해 증가 보석", value(builds.gems?.damage, "레벨"), mine.gems, "DAMAGE"),
    gemSection("cooldown", "재사용 대기시간 감소 보석", value(builds.gems?.cooldown, "레벨"), mine.gems, "COOLDOWN"),
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
      mine.cardSet,
      (a, b) => a.set === b.set && a.pieces === b.pieces && a.awakening === b.awakening,
      cardLabel,
    ),
    single("topStat", "주력 전투 특성", name(builds.topStats), builds.topStats?.hidden?.count ?? 0, mine.topStat, (a, b) => a === b, String),
    several("bracelet", "팔찌 전투 특성", name(builds.braceletStats), mine.braceletStats, "특성"),
  ];
}
