// M41 (PM 총괄 11-22 13:40): 숨결 없이 vs 숨결 최대 for one part and the same target. Each side is valued at market:
// 누골 (the gold paid when refining) plus every material at its unit price, owned ones too, so the two ways are
// compared alike whatever is in the bag. One breath's value is what using breaths saves per breath when the breath
// itself costs nothing: (no-breath total − with-breath total with breath at 0G) ÷ expected breaths, then set against
// the breath's market price. Not the api's OPTIMAL (switched off until it is opened with its web flag).
import type { MaterialPrice } from "../market/model";
import { stageGold, stageMaterials, sumQuantities, type Mode, type Plan } from "./model";

/** 용암의 숨결 · 빙하의 숨결 (완갑 uses both). */
export const isBreath = (name: string) => /숨결$/.test(name);

export type BreathSide = {
  /** Gold paid when refining (누골). */
  nugol: number;
  /** 누골 + priced materials at market, rounded once. */
  total: number;
  /** Expected (or the mode's) breaths used. */
  breaths: number;
};

export type BreathCompare = {
  without: BreathSide;
  with: BreathSide;
  cheaper: "with" | "without" | "same";
  /** Saving per breath with breath at 0G; null without breaths. */
  breathValue: number | null;
  /** The breaths' market unit price (weighted by use when 완갑 takes both); null when one is unpriced. */
  breathPrice: number | null;
  /** BUY: worth buying at market; SKIP: not using is cheaper; null when there is no price to judge by. */
  verdict: "BUY" | "SKIP" | null;
  /** Materials without a unit price, left out of both sides (first-seen order). */
  unpriced: string[];
};

const unitOf = (prices: readonly MaterialPrice[], name: string) => {
  const price = prices.find((p) => p.name === name);
  return price?.status === "PRICED" && price.unitPriceGold != null ? price.unitPriceGold : null;
};

function side(plan: Plan, mode: Mode, prices: readonly MaterialPrice[], unpriced: Set<string>) {
  const materials = sumQuantities(plan.stages.map((stage) => stageMaterials(stage, mode)));
  const gold = plan.stages.reduce((sum, stage) => sum + stageGold(stage, mode), 0);
  let value = 0;
  let breathCost = 0;
  let breaths = 0;
  for (const item of materials) {
    const unit = unitOf(prices, item.name);
    if (isBreath(item.name)) breaths += item.amount;
    if (unit == null) {
      unpriced.add(item.name);
      continue;
    }
    value += item.amount * unit;
    if (isBreath(item.name)) breathCost += item.amount * unit;
  }
  return { gold, value, breathCost, breaths, materials };
}

/** null until prices are there (nothing to value the sides with). */
export function breathCompare(
  without: Plan,
  withBreath: Plan,
  mode: Mode,
  prices: readonly MaterialPrice[] | null,
): BreathCompare | null {
  if (!prices) return null;
  const unpriced = new Set<string>();
  const a = side(without, mode, prices, unpriced);
  const b = side(withBreath, mode, prices, unpriced);
  const aTotal = a.gold + a.value;
  const bTotal = b.gold + b.value;
  const bFree = bTotal - b.breathCost;
  const breathValue = b.breaths > 0 ? Math.round((aTotal - bFree) / b.breaths) : null;
  const breathItems = b.materials.filter((item) => isBreath(item.name) && item.amount > 0);
  const units = breathItems.map((item) => unitOf(prices, item.name));
  const breathPrice =
    breathItems.length > 0 && units.every((u) => u != null)
      ? Math.round(breathItems.reduce((sum, item, i) => sum + item.amount * units[i]!, 0) / b.breaths)
      : null;
  const totalA = Math.round(aTotal);
  const totalB = Math.round(bTotal);
  return {
    without: { nugol: Math.round(a.gold), total: totalA, breaths: Math.round(a.breaths) },
    with: { nugol: Math.round(b.gold), total: totalB, breaths: Math.round(b.breaths) },
    cheaper: totalA === totalB ? "same" : totalB < totalA ? "with" : "without",
    breathValue,
    breathPrice,
    verdict: breathValue == null || breathPrice == null ? null : breathValue >= breathPrice ? "BUY" : "SKIP",
    unpriced: [...unpriced],
  };
}
