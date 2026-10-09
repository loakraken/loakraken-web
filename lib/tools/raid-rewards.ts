// Raid clear rewards: gold, bound gold and "더보기" (bonus reward) cost per
// gate. Static data in data/raid-rewards.json, sourced only from official
// notices and guides; values the official site does not publish stay null and
// show as "데이터 없음" (calc-verification team verifies and fills them).
import raw from "./data/raid-rewards.json";

export type Difficulty =
  | "NORMAL"
  | "HARD"
  | "NIGHTMARE"
  | "SINGLE"
  | "STAGE_1"
  | "STAGE_2"
  | "STAGE_3";
export type Category = "KAZEROS" | "SHADOW" | "EPIC" | "EXTREME" | "ABYSS" | "LEGION";
/** OFFICIAL: from an official notice/guide. SITES: not published officially,
 * and target sites agree on the value (PM 총괄 2026-10-10: shown as
 * "사이트 실측" with the check date). UNVERIFIED: no value yet. */
export type Status = "OFFICIAL" | "SITES" | "UNVERIFIED";

export type Gate = {
  gate: number;
  gold: number | null;
  /** Part of `gold` that is bound to the character. */
  boundGold: number | null;
  /** Gold spent on the bonus reward ("더보기"); null when there is none. */
  moreCost: number | null;
};
export type Mode = {
  difficulty: Difficulty;
  minItemLevel: number;
  status: Status;
  source: string | null;
  gates: Gate[];
};
export type Raid = {
  id: string;
  category: Category;
  name: string;
  shortName: string;
  players: number;
  structureSource: string;
  /** Period-limited content (extreme). */
  limitedTime?: boolean;
  /** One reward per roster per week instead of per character. */
  rosterWeekly?: boolean;
  /** Gold is paid even to characters not designated for gold. */
  goldWithoutDesignation?: boolean;
  modes: Mode[];
};
export type Source = { title: string; url: string; date: string | null };
export type RaidData = {
  version: string;
  checkedAt: string;
  rules: {
    goldCharactersPerRoster: number;
    endContentGoldClearsPerCharacter: number;
    weeklyReset: string;
    source: string;
  };
  sources: Record<string, Source>;
  raids: Raid[];
};

export const RAID_DATA = raw as RaidData;

export const CATEGORY_LABEL: Record<Category, string> = {
  KAZEROS: "카제로스 레이드",
  EPIC: "에픽 레이드",
  SHADOW: "그림자 레이드",
  EXTREME: "익스트림",
  ABYSS: "어비스 던전",
  LEGION: "군단장 레이드",
};
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  NORMAL: "노말",
  HARD: "하드",
  NIGHTMARE: "나이트메어",
  SINGLE: "싱글",
  STAGE_1: "1단계",
  STAGE_2: "2단계",
  STAGE_3: "3단계",
};
export const STATUS_LABEL: Record<Status, string> = {
  OFFICIAL: "공식",
  SITES: "사이트 실측",
  UNVERIFIED: "데이터 없음",
};

export type ModeTotals = {
  gold: number;
  boundGold: number;
  tradableGold: number;
  /** Sum of bonus costs, or null when the mode has no bonus reward. */
  moreCost: number | null;
};

/** Totals over all gates, or null while any gold value is missing. */
export function modeTotals(mode: Mode): ModeTotals | null {
  if (mode.gates.some((g) => g.gold === null || g.boundGold === null)) return null;
  const gold = mode.gates.reduce((sum, g) => sum + (g.gold ?? 0), 0);
  const boundGold = mode.gates.reduce((sum, g) => sum + (g.boundGold ?? 0), 0);
  const costs = mode.gates.map((g) => g.moreCost);
  return {
    gold,
    boundGold,
    tradableGold: gold - boundGold,
    moreCost: costs.every((c) => c === null)
      ? null
      : costs.some((c) => c === null)
        ? null
        : costs.reduce<number>((sum, c) => sum + (c ?? 0), 0),
  };
}

/** Consistency problems in the data; the test suite expects none. */
export function checkRaidData(data: RaidData): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const raid of data.raids) {
    if (ids.has(raid.id)) problems.push(`${raid.id}: duplicate id`);
    ids.add(raid.id);
    if (!data.sources[raid.structureSource])
      problems.push(`${raid.id}: unknown structure source ${raid.structureSource}`);
    const seen = new Set<Difficulty>();
    for (const mode of raid.modes) {
      const where = `${raid.id}/${mode.difficulty}`;
      if (seen.has(mode.difficulty)) problems.push(`${where}: duplicate difficulty`);
      seen.add(mode.difficulty);
      if (!mode.gates.length) problems.push(`${where}: no gates`);
      mode.gates.forEach((gate, i) => {
        if (gate.gate !== i + 1) problems.push(`${where}: gate ${gate.gate} out of order`);
        if (gate.gold !== null && gate.boundGold !== null && gate.boundGold > gate.gold)
          problems.push(`${where} G${gate.gate}: bound gold above gold`);
        for (const value of [gate.gold, gate.boundGold, gate.moreCost])
          if (value !== null && (!Number.isInteger(value) || value < 0))
            problems.push(`${where} G${gate.gate}: bad value ${value}`);
      });
      const complete = mode.gates.every((g) => g.gold !== null && g.boundGold !== null);
      if (mode.status === "UNVERIFIED") {
        if (mode.gates.some((g) => g.gold !== null))
          problems.push(`${where}: UNVERIFIED but has values`);
      } else {
        if (!complete) problems.push(`${where}: ${mode.status} but values missing`);
        if (!mode.source || !data.sources[mode.source])
          problems.push(`${where}: ${mode.status} needs a known source`);
      }
    }
  }
  if (!data.sources[data.rules.source]) problems.push("rules: unknown source");
  return problems;
}

export const formatGold = (value: number) => `${value.toLocaleString("ko-KR")}G`;
