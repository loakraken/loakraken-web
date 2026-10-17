// The life-material exchange vendor (교환 상인), shared by 생명의 기운 효율 and
// 아비도스 제작 손익. Rules, grades and item names are the allowed single
// source's own script data (data/life-energy.json); kept apart from both tools
// so neither imports the other.
import raw from "./data/life-energy.json";

export type Grade = "abidos" | "uncommon" | "common" | "rare";
export type Role = Grade | "powder";
export const GRADES: Grade[] = ["abidos", "uncommon", "common", "rare"];
export const ROLES: Role[] = [...GRADES, "powder"];

export type ExchangeRule = { from: Role; to: Role; give: number; get: number; only?: string[] };
export type Activity = {
  id: string;
  name: string;
  powder: string;
  minutes: number;
  items: Record<Grade, string | null>;
  per10k: Record<Grade, number>;
};
export type LifeEnergyData = {
  version: string;
  checkedAt: string;
  sources: Record<string, { title: string; url: string | null; date: string }>;
  sourceNote: string;
  recovery: { perTick: number; blessedPerTick: number; ticksPerDay: number; source: string };
  exchange: ExchangeRule[];
  activities: Activity[];
};

export const LIFE_DATA = raw as LifeEnergyData;

export const activityById = (id: string) => LIFE_DATA.activities.find((a) => a.id === id);

/** The exchange rules that apply to an activity (rare → common only for some). */
export const rulesFor = (activity: Activity, exchange: boolean) =>
  exchange ? LIFE_DATA.exchange.filter((r) => !r.only || r.only.includes(activity.id)) : [];

/** Display name of a role in an activity (powder has its own name). */
export const roleName = (activity: Activity, role: Role) => (role === "powder" ? activity.powder : activity.items[role] ?? role);

export type RoleCost = { unit: number; path: Role[] };

/**
 * Cheapest gold per item of every role when buying on the market, counting
 * exchange chains: a chain replaces the direct price only when it is at least
 * 0.5% cheaper. Powder cannot be bought; a role with no price and no chain is
 * Infinity (never 0).
 */
export function cheapestUnits(activity: Activity, buyUnit: (role: Role) => number, exchange: boolean): Record<Role, RoleCost> {
  const best = Object.fromEntries(ROLES.map((r) => [r, { unit: r === "powder" ? Infinity : buyUnit(r), path: [r] }])) as Record<Role, RoleCost>;
  const rules = rulesFor(activity, exchange);
  for (let pass = 0; pass < ROLES.length; pass++) {
    let changed = false;
    for (const r of rules) {
      const via = (best[r.from].unit * r.give) / r.get;
      if (via < best[r.to].unit * 0.995 - 1e-9) {
        best[r.to] = { unit: via, path: [...best[r.from].path, r.to] };
        changed = true;
      }
    }
    if (!changed) break;
  }
  return best;
}
