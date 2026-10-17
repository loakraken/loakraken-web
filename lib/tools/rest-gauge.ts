// Rest gauge rules (E39): only what the official guides and notices state.
// The maximums, the recharge ratio and the reward increase are not published,
// so they stay null and the daily-content feature waits (PM 총괄 2026-10-13).
import raw from "./data/rest-gauge.json";

export type RestGaugeData = {
  version: string;
  checkedAt: string;
  sources: Record<string, { title: string; url: string; date: string | null }>;
  resonance: { source: string; sharedBy: string[]; costPerEntry: number; refillAt: string; max: number | null };
  restBonus: {
    source: string;
    minToUse: number;
    rechargeRule: string;
    rechargeRatio: number | null;
    max: number | null;
    rewardIncrease: number | null;
  };
  guardianRest: { source: string; rechargeRule: string; rechargePerUnused: number | null; threshold: number | null };
  potions: { source: string; resonance: number; restBonus: number };
};

export const REST_GAUGE = raw as RestGaugeData;
