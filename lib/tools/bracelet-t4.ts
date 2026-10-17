// T4 bracelet effects (E42·E23): value bands and odds from the official
// probability page "팔찌 T4" (updated 2025-12-30), copied as published. Static
// data in data/bracelet-t4.json; for the simulator's bracelet edits and the
// bracelet range table (N11).
import raw from "./data/bracelet-t4.json";

export type Band = { relic: [number, number]; ancient: [number, number]; percent: number };
export type SpecialEffect = {
  /** The official effect text, as published. */
  text: string;
  /** Odds as a fixed effect; null when it only comes as a granted one. */
  fixedPercent: number | null;
  grantedPercent: number | null;
};
export type BraceletData = {
  version: string;
  checkedAt: string;
  source: { title: string; url: string; date: string };
  rules: {
    leapPoints: { relic: number; ancient: number };
    fixedEffectCount: { count: number; percent: number }[];
    grantedEffectCount: Record<"relic" | "ancient", { count: number; percent: number }[]>;
    maxPerKind: { base: number; combatStat: number; special: number };
    kindPercent: { base: number; combatStat: number; special: number };
    baseKindPercent: { mainStat: number; vitality: number };
    combatStats: string[];
    combatStatEachPercent: number;
    excludedRenormalized: boolean;
  };
  /** 힘/민첩/지능 bands; every value inside a band is equally likely. */
  mainStat: Band[];
  vitality: Band[];
  /** Same bands for every combat stat. */
  combatStat: Band[];
  special: Record<"relic" | "ancient", SpecialEffect[]>;
};

export const BRACELET_T4 = raw as BraceletData;

/** Consistency problems in the data; the test suite expects none. */
export function checkBraceletData(data: BraceletData): string[] {
  const problems: string[] = [];
  if (!data.source.url.startsWith("https://lostark.game.onstove.com/Probability")) problems.push("source: not the official page");
  for (const key of ["mainStat", "vitality", "combatStat"] as const) {
    const bands = data[key];
    const total = Math.round(bands.reduce((sum, b) => sum + b.percent, 0) * 1000) / 1000;
    if (total !== 100) problems.push(`${key}: odds sum to ${total}`);
    bands.forEach((band, i) => {
      for (const grade of ["relic", "ancient"] as const) {
        const [low, high] = band[grade];
        if (low > high) problems.push(`${key} ${i}: ${grade} band reversed`);
        if (i > 0 && low !== bands[i - 1][grade][1] + 1) problems.push(`${key} ${i}: ${grade} band not contiguous`);
      }
    });
  }
  for (const grade of ["relic", "ancient"] as const) {
    const list = data.special[grade];
    if (!list.length) problems.push(`special ${grade}: empty`);
    // The official table rounds to 5 places: the odds add up to 100 within that.
    for (const key of ["fixedPercent", "grantedPercent"] as const) {
      const total = list.reduce((sum, e) => sum + (e[key] ?? 0), 0);
      if (Math.abs(total - 100) > 0.001) problems.push(`special ${grade} ${key}: ${total.toFixed(4)}`);
    }
    for (const e of list) if (e.grantedPercent === null) problems.push(`special ${grade}: "${e.text}" has no granted odds`);
  }
  return problems;
}
