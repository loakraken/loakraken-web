// M41 (PM 총괄 11-22 13:40): 숨결 없이 vs 숨결 최대 for one part and the same target. Each side is valued at market:
// 누골 (the gold paid when refining) plus every material at its unit price, owned ones too, so the two ways are
// compared alike whatever is in the bag. One breath's value is what using breaths saves per breath when the breath
// itself costs nothing: (no-breath total − with-breath total with breath at 0G) ÷ expected breaths, then set against
// the breath's market price. Not the api's OPTIMAL (switched off until it is opened with its web flag).
import { MAX_PRICE_NAMES, type MaterialPrice } from "../market/model";
import {
  stageGold,
  stageMaterials,
  sumQuantities,
  summarize,
  type EquipmentType,
  type Mode,
  type PartPlan,
  type Plan,
} from "./model";

/** 용암의 숨결 · 빙하의 숨결 (완갑 uses both). */
export const isBreath = (name: string) => /숨결$/.test(name);

/** The breaths a part's 숨결 최대 plan uses: 무기 용암, 방어구 빙하, 완갑 both (the refining options' hints). */
export const breathNamesOf = (type: EquipmentType): string[] =>
  type === "WEAPON" ? ["용암의 숨결"] : type === "ARMOR" ? ["빙하의 숨결"] : ["용암의 숨결", "빙하의 숨결"];

/**
 * The one price list for the result and the breath compare (PM-프론트 #1932, performance first: one request a minute):
 * the page's own plans' materials in their order, then each part's breaths. The other way of a part uses the same
 * materials but for the breaths, so this covers both. Built the same way by both, so the key and the body match and
 * the query is shared. Past MAX_PRICE_NAMES with the breaths, the page's own list only (its prices never go off for
 * the compare, which then has no breath price and says so).
 */
export function priceNames(plans: readonly PartPlan[], mode: Mode, extra: readonly string[] = []): string[] {
  // `extra`: the 상급 재련 bands' materials (X3 part 2, web #1951), the same list from both callers.
  const own = [...new Set([...summarize([...plans], mode).materials.map((item) => item.name), ...extra])];
  const all = [...new Set([...own, ...plans.flatMap(({ part }) => breathNamesOf(part.type))])];
  return all.length <= MAX_PRICE_NAMES ? all : own;
}

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

/**
 * The row's left-out line. On screen at most two names, then how many more, so it stays within its two reserved lines
 * at 320 (#1932 follow-up P3). Read out, every name (PM-프론트 #1943: a breath only 숨결 최대 uses is nowhere else on
 * the page, so '외 N개' alone would take it away).
 */
export function leftOutLabel(names: readonly string[]) {
  if (names.length === 0) return { visible: "", full: "" };
  const lead = "시세가 없어 뺀 재료: ";
  const visible = `${lead}${names.slice(0, 2).join(", ")}${names.length > 2 ? ` 외 ${names.length - 2}개` : ""}`;
  return { visible, full: `${lead}${names.join(", ")}` };
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
  // Both decisions below use the unrounded gold; only what is returned for the screen is rounded (web #1985: rounded
  // first, a price just above break-even read BUY at 1,155 vs 1,155 while the same row's totals said 'without' was
  // cheaper). With each breath at its price, BUY ⇔ the with-breath total ≤ the without-breath total, so the two agree.
  const value = b.breaths > 0 && uneven.length === 0 ? (aTotal - bFree) / b.breaths : null;
  const breathItems = b.materials.filter((item) => isBreath(item.name) && item.amount > 0);
  const units = breathItems.map((item) => unitOf(prices, item.name));
  const unitPrice =
    breathItems.length > 0 && units.every((u) => u != null)
      ? breathItems.reduce((sum, item, i) => sum + item.amount * units[i]!, 0) / b.breaths
      : null;
  const breathValue = value == null ? null : Math.round(value);
  const breathPrice = unitPrice == null ? null : Math.round(unitPrice);
  const totalA = Math.round(aTotal);
  const totalB = Math.round(bTotal);
  // Float noise (sums of many products) is not a difference: within a thousandth of a gold the two ways cost the same.
  const SAME = 1e-3;
  const gap = bTotal - aTotal;
  // Which one costs less is known only when no side is short of something the other is not: an unpriced breath
  // (숨결 최대 only, PM-프론트 #1932 P2) or the uneven materials (both sides). The same gap on both sides cancels out.
  const comparable = !a.breathUnpriced && !b.breathUnpriced && uneven.length === 0;
  // A total that leaves anything out reads '이상', even when the other side leaves out the same (#1932 follow-up P3).
  const withIncomplete = b.breathUnpriced || b.missing.size > 0;
  const withoutIncomplete = a.breathUnpriced || a.missing.size > 0;
  return {
    without: { nugol: Math.round(a.gold), total: totalA, breaths: Math.round(a.breaths), incomplete: withoutIncomplete },
    with: { nugol: Math.round(b.gold), total: totalB, breaths: Math.round(b.breaths), incomplete: withIncomplete },
    cheaper: !comparable ? null : Math.abs(gap) <= SAME ? "same" : gap < 0 ? "with" : "without",
    breathValue,
    breathPrice,
    verdict: value == null || unitPrice == null ? null : value >= unitPrice - SAME / Math.max(1, b.breaths) ? "BUY" : "SKIP",
    unpriced: [...unpriced],
    uneven,
  };
}
