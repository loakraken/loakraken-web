// 아비도스 제작 손익 (checklist M46·N10, E41): one craft of 아비도스 / 상급
// 아비도스 융화 재료 per life skill, valued at today's market prices.
//   expected items = 100 × (1 + p), p = 5% × (1 + increase)
//     (100 a craft, 200 on a great success; increase 0~100% from the player)
//   cost   = Σ material qty × unit price + craft gold × (1 − fee cut)
//   value  = expected items × unit price of the result
//            (selling: × (1 − 5% market fee); using it yourself: no fee)
// Yields were solved from two calculators' screens (data/abidos-craft.json
// sourceNote); materials, gold and energy come from the crafting database.
// The market fee is the one the auction tool uses (MARKET_FEE_PERCENT).
import raw from "./data/abidos-craft.json";
import { MARKET_FEE_PERCENT } from "./auction";

export type OutputId = "abidos" | "superior";
export type CraftData = {
  version: string;
  checkedAt: string;
  sources: Record<string, { title: string; url: string | null; date: string }>;
  sourceNote: string;
  yield: { base: number; greatSuccess: number; greatSuccessPercent: number; source: string };
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
  missing: string[];
};

export function craftResult(
  outputId: OutputId,
  skillId: string,
  unitPrice: (name: string) => number | null,
  increasePercent: number,
  feeCutPercent: number,
): CraftResult {
  const output = CRAFT_DATA.outputs.find((o) => o.id === outputId)!;
  const skill = CRAFT_DATA.skills.find((s) => s.id === skillId)!;
  const materials = skill.materials[outputId].map(([name, qty]) => {
    const unit = unitPrice(name);
    return { name, qty, unit, gold: unit == null ? null : unit * qty };
  });
  const craftGold = output.gold * (1 - feeCutPercent / 100);
  const expected = expectedYield(increasePercent);
  const resultUnit = unitPrice(output.name);
  const missing = [...materials.filter((m) => m.unit == null).map((m) => m.name), ...(resultUnit == null ? [output.name] : [])];
  const cost = materials.some((m) => m.gold == null) ? null : materials.reduce((sum, m) => sum + (m.gold as number), 0) + craftGold;
  const use = resultUnit == null ? null : expected * resultUnit;
  const sell = use == null ? null : use * (1 - MARKET_FEE_PERCENT / 100);
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
