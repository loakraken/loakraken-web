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
  /** The total leaves out something the other side does not (an unpriced breath, or an unpriced material in another amount). */
  incomplete: boolean;
};

export type BreathCompare = {
  without: BreathSide;
  with: BreathSide;
  /** null when either total is incomplete (the gap is not known, PM-프론트 #1932). */
  cheaper: "with" | "without" | "same" | null;
  /** Saving per breath with breath at 0G; null without breaths or when an unpriced material differs between the sides. */
  breathValue: number | null;
  /** The breaths' market unit price (weighted by use when 완갑 takes both); null when one is unpriced. */
  breathPrice: number | null;
  /** BUY: worth buying at market; SKIP: not using is cheaper; null when there is no price to judge by. */
  verdict: "BUY" | "SKIP" | null;
  /** Materials without a unit price, left out of both sides (first-seen order). */
  unpriced: string[];
  /** Unpriced materials other than breath used in different amounts on the two sides: they bias both the totals and the
   * saving, so nothing is compared (PM-프론트 ruling on #1932). The same amount on both sides cancels out. */
  uneven: string[];
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
  let breathUnpriced = false;
  /** Unpriced amounts by name, to see whether the two sides leave out the same thing. */
  const missing = new Map<string, number>();
  for (const item of materials) {
    const unit = unitOf(prices, item.name);
    if (isBreath(item.name)) breaths += item.amount;
    if (unit == null) {
      unpriced.add(item.name);
      if (item.amount > 0) {
        if (isBreath(item.name)) breathUnpriced = true;
        else missing.set(item.name, item.amount);
      }
      continue;
    }
    value += item.amount * unit;
    if (isBreath(item.name)) breathCost += item.amount * unit;
  }
  return { gold, value, breathCost, breaths, breathUnpriced, missing, materials };
}

/** Unpriced non-breath materials whose amounts differ between the sides (a rounding hair is the same amount). */
function unevenOf(a: Map<string, number>, b: Map<string, number>) {
  const names = [...new Set([...a.keys(), ...b.keys()])];
  return names.filter((name) => Math.abs((a.get(name) ?? 0) - (b.get(name) ?? 0)) > 1e-6);
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
  // An unpriced material the two sides use in different amounts biases both totals and the saving: compare nothing.
  // The same amount on both sides cancels out (each total is short by the same gold).
  const uneven = unevenOf(a.missing, b.missing);
  const breathValue = b.breaths > 0 && uneven.length === 0 ? Math.round((aTotal - bFree) / b.breaths) : null;
  const breathItems = b.materials.filter((item) => isBreath(item.name) && item.amount > 0);
  const units = breathItems.map((item) => unitOf(prices, item.name));
  const breathPrice =
    breathItems.length > 0 && units.every((u) => u != null)
      ? Math.round(breathItems.reduce((sum, item, i) => sum + item.amount * units[i]!, 0) / b.breaths)
      : null;
  const totalA = Math.round(aTotal);
  const totalB = Math.round(bTotal);
  // A side is short of something the other is not: an unpriced breath (숨결 최대 only, PM-프론트 #1932 P2), or the
  // uneven materials (both sides). Then which one costs less is not known.
  const withIncomplete = b.breathUnpriced || uneven.length > 0;
  const withoutIncomplete = a.breathUnpriced || uneven.length > 0;
  const comparable = !withIncomplete && !withoutIncomplete;
  return {
    without: { nugol: Math.round(a.gold), total: totalA, breaths: Math.round(a.breaths), incomplete: withoutIncomplete },
    with: { nugol: Math.round(b.gold), total: totalB, breaths: Math.round(b.breaths), incomplete: withIncomplete },
    cheaper: !comparable ? null : totalA === totalB ? "same" : totalB < totalA ? "with" : "without",
    breathValue,
    breathPrice,
    verdict: breathValue == null || breathPrice == null ? null : breathValue >= breathPrice ? "BUY" : "SKIP",
    unpriced: [...unpriced],
    uneven,
  };
}
