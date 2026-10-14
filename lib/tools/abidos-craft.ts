// 아비도스 제작 손익 (checklist M46·N10, E41): one craft of 아비도스 / 상급
// 아비도스 융화 재료 per life skill, valued at today's market prices.
//   expected items = 10 × (1 + p), p = 5% × (1 + increase)
//     (10 a craft, 20 on a great success; increase 0~100% from the player)
//   cost   = Σ material qty × unit price + ⌈craft gold × (1 − fee cut)⌉
//   value  = using it yourself: expected items × unit price of the result;
//            selling: (unit price − ⌈unit price × 5%⌉) × expected items —
//            fusion materials trade one at a time (market bundle count 1),
//            so the fee is rounded up per item
// Rounding follows comparison calculator C (calc verification 2026-10-13
// 19:50, sale fee re-checked 2026-10-14): craft gold rounds up (520 × 0.83 =
// 431.6 → 432), the market fee is rounded up per item (221 → 209). Calculator A rounds the craft gold down
// and takes the fee as a plain × 0.95 — a proven definition difference.
// Yields were solved from two calculators' screens (data/abidos-craft.json
// sourceNote); materials, gold and energy come from the crafting database.
// The market fee is the auction tool's (marketFee: 5%, rounded up).
import raw from "./data/abidos-craft.json";
import { marketFee } from "./auction";

/** Craft gold after a fee cut given in percent with at most one decimal, rounded up. */
export function craftGoldAfterCut(gold: number, feeCutPercent: number) {
  // Integer arithmetic: 400 × 0.83 in floating point is 332.00000000000006,
  // which a plain Math.ceil would turn into 333.
  return Math.ceil((gold * (1000 - Math.round(feeCutPercent * 10))) / 1000);
}

/**
 * Estate energy one craft costs after the reductions (percent, one decimal):
 * ⌊base × (1 − (overall + category)/100)⌋ — the cuts add up and the result
 * rounds down (calc verification 2026-10-13 23:16: 288·13% → 250, 360·17% →
 * 298, overall 10 + 특수 10 → 230). Never below 0.
 */
export function energyAfterCut(base: number, overallPercent: number, categoryPercent: number) {
  const cut = Math.round(overallPercent * 10) + Math.round(categoryPercent * 10);
  return Math.max(0, Math.floor((base * (1000 - cut)) / 1000));
}

/** Gold received when the expected items are sold one by one, the fee taken per item. */
export function sellValue(unitPrice: number, expected: number) {
  return (unitPrice - marketFee(unitPrice)) * expected;
}

export type OutputId = "abidos" | "superior";
export type CraftData = {
  version: string;
  checkedAt: string;
  sources: Record<string, { title: string; url: string | null; date: string }>;
  sourceNote: string;
  yield: { base: number; greatSuccess: number; greatSuccessPercent: number; source: string };
  /** The estate energy-cost reduction: the craft category whose cut adds to the overall one. */
  energyCut: { category: string; source: string };
  outputs: { id: OutputId; name: string; gold: number; energy: number; time: string }[];
  skills: { id: string; name: string; materials: Record<OutputId, [string, number][]> }[];
};

// JSON gives the material pairs as arrays; the checker below validates them.
export const CRAFT_DATA = raw as unknown as CraftData;

/** Every market name the calculator prices: all materials and both results. */
export const craftMarketNames = () => [
  ...new Set([
    ...CRAFT_DATA.outputs.map((o) => o.name),
    ...CRAFT_DATA.skills.flatMap((s) => Object.values(s.materials).flatMap((list) => list.map(([name]) => name))),
  ]),
];

/** Great-success chance (0~1) for an increase given in percent (0~100). */
export const greatSuccessChance = (increasePercent: number) =>
  (CRAFT_DATA.yield.greatSuccessPercent / 100) * (1 + increasePercent / 100);

/** Expected items from one craft. */
export function expectedYield(increasePercent: number) {
  const p = greatSuccessChance(increasePercent);
  return CRAFT_DATA.yield.base * (1 - p) + CRAFT_DATA.yield.greatSuccess * p;
}

export type CraftResult = {
  output: CraftData["outputs"][number];
  skill: CraftData["skills"][number];
  materials: { name: string; qty: number; unit: number | null; gold: number | null }[];
  /** Craft gold after the fee cut. */
  craftGold: number;
  expected: number;
  /** null while any price is missing (never counted as 0). */
  cost: number | null;
  /** Value of the expected items when sold (after the market fee) and when used. */
  sell: number | null;
  use: number | null;
  sellProfit: number | null;
  useProfit: number | null;
  /** Estate energy one craft costs after the reductions. */
  energy: number;
  /** Profit per 100 estate energy (after the reductions); null at 0 energy. */
  sellPer100Energy: number | null;
  usePer100Energy: number | null;
  missing: string[];
};

export function craftResult(
  outputId: OutputId,
  skillId: string,
  unitPrice: (name: string) => number | null,
  increasePercent: number,
  feeCutPercent: number,
  energyCut: { overall: number; category: number } = { overall: 0, category: 0 },
): CraftResult {
  const output = CRAFT_DATA.outputs.find((o) => o.id === outputId)!;
  const skill = CRAFT_DATA.skills.find((s) => s.id === skillId)!;
  const materials = skill.materials[outputId].map(([name, qty]) => {
    const unit = unitPrice(name);
    return { name, qty, unit, gold: unit == null ? null : unit * qty };
  });
  const craftGold = craftGoldAfterCut(output.gold, feeCutPercent);
  const energy = energyAfterCut(output.energy, energyCut.overall, energyCut.category);
  const expected = expectedYield(increasePercent);
  const resultUnit = unitPrice(output.name);
  const missing = [...materials.filter((m) => m.unit == null).map((m) => m.name), ...(resultUnit == null ? [output.name] : [])];
  const cost = materials.some((m) => m.gold == null) ? null : materials.reduce((sum, m) => sum + (m.gold as number), 0) + craftGold;
  const use = resultUnit == null ? null : expected * resultUnit;
  const sell = resultUnit == null ? null : sellValue(resultUnit, expected);
  return {
    output,
    skill,
    materials,
    craftGold,
    expected,
    cost,
    sell,
    use,
    sellProfit: cost == null || sell == null ? null : sell - cost,
    useProfit: cost == null || use == null ? null : use - cost,
    energy,
    sellPer100Energy: cost == null || sell == null || energy <= 0 ? null : ((sell - cost) * 100) / energy,
    usePer100Energy: cost == null || use == null || energy <= 0 ? null : ((use - cost) * 100) / energy,
    missing,
  };
}

/** A typed percent: 0~max, at most one decimal; null when empty or out of range. */
export function parsePercent(value: string, max = 100): number | null {
  if (!/^\d{1,3}(\.\d)?$/.test(value)) return null;
  const n = Number(value);
  return n >= 0 && n <= max ? n : null;
}

/** Consistency problems in the data; the test suite expects none. */
export function checkCraftData(data: CraftData): string[] {
  const problems: string[] = [];
  if (!data.sources[data.yield.source]) problems.push("yield: unknown source");
  if (data.yield.greatSuccess <= data.yield.base) problems.push("yield: great success not larger");
  for (const s of data.skills)
    for (const o of data.outputs) {
      const list = s.materials[o.id];
      if (!list?.length) problems.push(`${s.id}/${o.id}: no materials`);
      for (const [name, qty] of list ?? []) if (!Number.isInteger(qty) || qty <= 0) problems.push(`${s.id}/${o.id}: bad qty ${name}`);
    }
  return problems;
}
