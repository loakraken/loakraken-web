// 생명의 기운 효율 (checklist M61): what a given amount of life energy earns
// in each life skill, at today's market prices.
//   gathered  = ⌊per-10,000 yield × energy ÷ 10,000⌋ for each material grade
//   raw value = Σ gathered × (bundle price − ⌈bundle price × 5%⌉) ÷ bundle size
//   crafted   = the most 아비도스 / 상급 아비도스 융화 재료 crafts the gathered
//               materials allow — nothing bought, shortfalls filled through
//               the exchange vendor — then
//               raw value + revenue − value of the materials used
//               − craft gold + value of the exchange leftovers
//   best      = the largest of selling raw, crafting 아비도스, crafting 상급
//   per day   = best ÷ energy × 30 (33 blessed) × 6 × 24
// Yields, minutes, exchange rules and the recovery rate are the allowed single
// source's own script data (data/life-energy.json sourceNote); the official
// guide gives no numbers. The craft recipe, gold and yield are the 아비도스
// 제작 손익 tool's. A missing market price is never counted as 0.
import {
  GRADES,
  LIFE_DATA,
  ROLES,
  rulesFor,
  type Activity,
  type ExchangeRule,
  type Grade,
  type LifeEnergyData,
  type Role,
} from "./life-exchange";
import { CRAFT_DATA, craftGoldAfterCut, expectedYield, type OutputId } from "./abidos-craft";
import { marketFee } from "./auction";

export { LIFE_DATA, rulesFor, type Activity, type ExchangeRule, type Grade, type LifeEnergyData, type Role } from "./life-exchange";

const RECIPE_GRADES = ["abidos", "uncommon", "common"] as const;

/** A market listing: the price of one bundle and how many items it holds. */
export type Quote = { bundlePrice: number; bundleCount: number };
export type Purpose = "sell" | "use";
export type LifeSettings = {
  /** 제작 수수료 감소, percent. */
  feeCut: number;
  /** 대성공 확률 증가, percent. */
  increase: number;
  /** Use the exchange vendor to fill shortfalls. */
  exchange: boolean;
  purpose: Purpose;
};

/** Gold one item brings when sold: the 5% fee is rounded up per bundle. */
export const sellUnit = (q: Quote) => (q.bundlePrice - marketFee(q.bundlePrice)) / q.bundleCount;
/** Gold one item costs on the market. */
export const buyUnit = (q: Quote) => q.bundlePrice / q.bundleCount;

/** Life energy recovered in a day: 30 (33 with the blessing) every 10 minutes. */
export const dailyEnergy = (blessed: boolean) =>
  (blessed ? LIFE_DATA.recovery.blessedPerTick : LIFE_DATA.recovery.perTick) * LIFE_DATA.recovery.ticksPerDay;

/** Materials gathered with the given energy, rounded down per grade. */
export function gathered(activity: Activity, energy: number): Record<Grade, number> {
  return Object.fromEntries(GRADES.map((g) => [g, Math.floor((activity.per10k[g] * energy) / 10000)])) as Record<Grade, number>;
}

const zero = (): Record<Role, number> => ({ abidos: 0, uncommon: 0, common: 0, rare: 0, powder: 0 });

export type CraftPlan = {
  feasible: boolean;
  crafts: number;
  /** Gathered materials the crafts consumed (directly or traded away). */
  used: Record<Role, number>;
  /** Items the exchange produced that the crafts did not need. */
  leftover: Record<Role, number>;
  exchanges: { rule: ExchangeRule; times: number }[];
  craftGold: number;
  expected: number;
  revenue: number;
  /** Change against selling everything raw. */
  profit: number;
};

/**
 * Crafts `crafts` times from the owned materials only. A shortfall is filled
 * with the exchange trade that gives up the least sale value per item got,
 * recursing when the trade's own input runs short (a trade is never chained
 * back through an item already on the path). Items the exchange produces are
 * spent before owned ones.
 */
export function planCrafts(
  activity: Activity,
  outputId: OutputId,
  crafts: number,
  owned: Record<Grade, number>,
  value: (role: Role) => number,
  fusionUnit: number,
  settings: LifeSettings,
): CraftPlan {
  const output = CRAFT_DATA.outputs.find((o) => o.id === outputId)!;
  const recipe = Object.fromEntries(
    CRAFT_DATA.skills.find((s) => s.id === activity.id)!.materials[outputId].map(([, qty], i) => [RECIPE_GRADES[i], qty]),
  ) as Record<(typeof RECIPE_GRADES)[number], number>;
  const rules = rulesFor(activity, settings.exchange);
  const n = Math.max(0, Math.floor(crafts));
  const left = { ...zero(), ...owned };
  const extra = zero();
  const used = zero();
  const traded = new Map<ExchangeRule, number>();
  const have = (role: Role) => left[role] + extra[role];
  const take = (role: Role, qty: number) => {
    const fromExtra = Math.min(extra[role], qty);
    extra[role] -= fromExtra;
    left[role] -= qty - fromExtra;
    used[role] += qty - fromExtra;
  };
  // Sale value given up to obtain qty of role that is not on hand (nothing is bought).
  const obtainCost = (role: Role, qty: number, path: Role[]): number => {
    let best = Infinity;
    for (const r of rules) {
      if (r.to !== role || path.includes(r.from)) continue;
      const times = Math.ceil(qty / r.get);
      best = Math.min(best, (spendCost(r.from, times * r.give, [...path, role]) * qty) / (times * r.get));
    }
    return best;
  };
  // Sale value given up by spending qty of role: produced items are free, owned ones cost their value.
  const spendCost = (role: Role, qty: number, path: Role[]): number => {
    const fromExtra = Math.min(extra[role], qty);
    const fromLeft = Math.min(left[role], qty - fromExtra);
    const rest = qty - fromExtra - fromLeft;
    const cost = fromLeft > 0 ? fromLeft * value(role) : 0;
    return rest <= 0 ? cost : cost + obtainCost(role, rest, path);
  };
  const ensure = (role: Role, need: number, path: Role[]): boolean => {
    const here = [...path, role];
    for (let guard = 0; have(role) < need; guard++) {
      if (guard > 10000) return false;
      const short = need - have(role);
      let bestCost = Infinity;
      let choice: { rule: ExchangeRule; times: number } | null = null;
      for (const r of rules) {
        if (r.to !== role || here.includes(r.from)) continue;
        const wanted = Math.ceil(short / r.get);
        const possible = Math.min(wanted, Math.floor(have(r.from) / r.give));
        const options: { times: number; cost: number; margin: number }[] = [];
        if (possible >= 1)
          options.push({ times: possible, cost: spendCost(r.from, possible * r.give, here) / (possible * r.get), margin: 1 });
        if (possible < wanted)
          options.push({ times: wanted, cost: obtainCost(r.from, wanted * r.give, here) / (wanted * r.get), margin: 0.995 });
        for (const o of options)
          if (o.cost < bestCost * o.margin - 1e-9) {
            bestCost = o.cost;
            choice = { rule: r, times: o.times };
          }
      }
      if (!Number.isFinite(bestCost) || !choice) return false;
      const { rule, times } = choice;
      if (!ensure(rule.from, times * rule.give, here)) return false;
      take(rule.from, times * rule.give);
      extra[role] += times * rule.get;
      traded.set(rule, (traded.get(rule) ?? 0) + times);
    }
    return true;
  };

  const short: Record<string, number> = {};
  for (const g of RECIPE_GRADES) {
    const need = n * recipe[g];
    const direct = Math.min(left[g], need);
    take(g, direct);
    short[g] = need - direct;
  }
  let feasible = true;
  for (const g of RECIPE_GRADES) {
    if (!ensure(g, short[g], [])) {
      feasible = false;
      break;
    }
    take(g, short[g]);
  }
  const worth = (counts: Record<Role, number>) => ROLES.reduce((sum, r) => sum + counts[r] * value(r), 0);
  const craftGold = n * craftGoldAfterCut(output.gold, settings.feeCut);
  const expected = n * expectedYield(settings.increase);
  const revenue = expected * fusionUnit;
  return {
    feasible,
    crafts: n,
    used,
    leftover: extra,
    exchanges: [...traded].map(([rule, times]) => ({ rule, times })),
    craftGold,
    expected,
    revenue,
    profit: revenue - worth(used) - craftGold + worth(extra),
  };
}

/** The most crafts the owned materials allow (0 when not even one). */
export function maxCrafts(feasible: (crafts: number) => boolean) {
  if (!feasible(1)) return 0;
  let lo = 1;
  let hi = 2;
  while (hi < 100000 && feasible(hi)) {
    lo = hi;
    hi *= 2;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (feasible(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

export type Option = { kind: "raw" | OutputId; crafts: number; value: number };
export type ActivityResult = {
  activity: Activity;
  gathered: Record<Grade, number>;
  minutes: number;
  /** null while a gathered material has no price. */
  raw: Option | null;
  /** Per output: null when its price (or a gathered price) is missing. */
  crafted: Record<OutputId, Option | null>;
  best: Option | null;
  missing: string[];
};

export function activityResult(
  activity: Activity,
  energy: number,
  quote: (name: string) => Quote | null,
  settings: LifeSettings,
): ActivityResult {
  const got = gathered(activity, energy);
  const missing = GRADES.filter((g) => got[g] > 0 && activity.items[g] && !quote(activity.items[g]!)).map((g) => activity.items[g]!);
  const quotes = Object.fromEntries(GRADES.map((g) => [g, activity.items[g] ? quote(activity.items[g]!) : null])) as Record<Grade, Quote | null>;
  // Powder has no market; a grade with no listing is never traded into (its value only matters if held).
  const value = (role: Role) => (role === "powder" ? 0 : quotes[role] ? sellUnit(quotes[role]!) : 0);
  const base = { activity, gathered: got, minutes: (activity.minutes * energy) / 10000, missing };
  if (missing.length) return { ...base, raw: null, crafted: { abidos: null, superior: null }, best: null };
  const rawValue = GRADES.reduce((sum, g) => sum + got[g] * value(g), 0);
  const rawOption: Option = { kind: "raw", crafts: 0, value: rawValue };
  const crafted = {} as Record<OutputId, Option | null>;
  for (const output of CRAFT_DATA.outputs) {
    const id = output.id as OutputId;
    const q = quote(output.name);
    if (!q) {
      missing.push(output.name);
      crafted[id] = null;
      continue;
    }
    const unit = settings.purpose === "sell" ? sellUnit(q) : buyUnit(q);
    const plan = (n: number) => planCrafts(activity, id, n, got, value, unit, settings);
    const n = maxCrafts((c) => plan(c).feasible);
    crafted[id] = n === 0 ? { kind: id, crafts: 0, value: rawValue } : { kind: id, crafts: n, value: rawValue + plan(n).profit };
  }
  let best = rawOption;
  for (const o of Object.values(crafted)) if (o && o.crafts > 0 && o.value > best.value) best = o;
  return { ...base, raw: rawOption, crafted, best };
}

/** Every activity, best first; activities with a missing price go last. */
export function rankActivities(energy: number, quote: (name: string) => Quote | null, settings: LifeSettings) {
  return LIFE_DATA.activities
    .map((a) => activityResult(a, energy, quote, settings))
    .toSorted((a, b) => (b.best?.value ?? -Infinity) - (a.best?.value ?? -Infinity));
}

/** Every market name the tool prices. */
export const lifeMarketNames = () => [
  ...new Set([
    ...LIFE_DATA.activities.flatMap((a) => GRADES.map((g) => a.items[g]).filter((n): n is string => !!n)),
    ...CRAFT_DATA.outputs.map((o) => o.name),
  ]),
];

/** Consistency problems in the data; the test suite expects none. */
export function checkLifeData(data: LifeEnergyData): string[] {
  const problems: string[] = [];
  if (!data.sources[data.recovery.source]) problems.push("recovery: unknown source");
  for (const a of data.activities) {
    const skill = CRAFT_DATA.skills.find((s) => s.id === a.id);
    if (!skill) problems.push(`${a.id}: no craft recipe`);
    else
      for (const o of CRAFT_DATA.outputs)
        skill.materials[o.id as OutputId].forEach(([name], i) => {
          if (name !== a.items[RECIPE_GRADES[i]]) problems.push(`${a.id}/${o.id}: ${name} ≠ ${a.items[RECIPE_GRADES[i]]}`);
        });
    for (const g of GRADES) {
      if (!Number.isInteger(a.per10k[g]) || a.per10k[g] < 0) problems.push(`${a.id}: bad yield ${g}`);
      if (a.per10k[g] > 0 && !a.items[g]) problems.push(`${a.id}: yield without item ${g}`);
    }
  }
  return problems;
}
