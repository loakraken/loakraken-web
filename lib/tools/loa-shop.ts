// 로아샵 효율 (checklist L45): an in-game shop package's contents valued at
// today's market prices, against its price in royal crystals. Formula
// confirmed by calc verification (2026-10-12):
//   gold value   = Σ qty × unit price (market price ÷ bundle size)
//   royal value  = gold × 2,750 ÷ (gold for 100 crystals at the in-game
//                  crystal exchange)  — 100 crystals = 2,750 royal crystals
//                  at the official shop (크리스탈 [200개] = 5,500)
//   gain         = royal value − package price
// Only the official path (royal → crystal → in-game exchange gold) is used;
// no off-game rate exists here (PM 총괄 2026-10-13). The exchange rate is
// typed by the player from the game and stays in this browser. Contents
// without a market price are "미확인", never 0. Static data in
// data/loa-shop.json, from the official shop notices.
import raw from "./data/loa-shop.json";

export type ShopItem = {
  kind: "market" | "crystal";
  /** Market item name (or "크리스탈"). */
  name: string;
  /** Units per set. */
  qty: number;
  /** How the set holds them, from the notice. */
  detail: string | null;
};
export type ShopPackage = {
  id: string;
  name: string;
  priceRoyal: number;
  /** Sale period, the notice's words. */
  period: string;
  /** The day whose regular maintenance ends the sale (KST date), null while "별도 안내 시". */
  until: string | null;
  /** Purchase limit, the notice's words. */
  limit: string;
  /** A bonus set every `every` purchases; `text` is the notice's words. */
  bonus: { every: number; text: string } | null;
  source: string;
  items: ShopItem[];
};
export type ShopData = {
  version: string;
  checkedAt: string;
  sources: Record<string, { title: string; url: string; date: string }>;
  crystal: { royalPer100: number; source: string };
  unknown: string[];
  packages: ShopPackage[];
};

export const SHOP_DATA = raw as ShopData;

/** Purchases and the sets they give: a bonus package is valued as a full bonus round. */
export function purchasePlan(pkg: ShopPackage) {
  const purchases = pkg.bonus ? pkg.bonus.every : 1;
  const sets = pkg.bonus ? purchases + 1 : 1;
  return { purchases, sets, priceRoyal: pkg.priceRoyal * purchases };
}

/** Market item names a package list needs prices for. */
export const marketNames = (packages: ShopPackage[]) => [
  ...new Set(packages.flatMap((p) => p.items.filter((i) => i.kind === "market").map((i) => i.name))),
];

export type ItemValue = ShopItem & {
  /** Units across the whole plan (sets × qty). */
  total: number;
  /** Gold per unit, or null when unknown (no market price, or no exchange rate for crystals). */
  unit: number | null;
  gold: number | null;
};
export type PackageValue = {
  purchases: number;
  sets: number;
  priceRoyal: number;
  items: ItemValue[];
  /** Gold of the contents whose value is known. */
  gold: number;
  /** Contents left out of `gold` because their value is unknown. */
  unknown: ItemValue[];
  /** Crystals the same royal crystals would buy at the official shop. */
  crystalsForPrice: number;
  /** Crystals inside the package. */
  crystals: number;
  /** null without an exchange rate, or while any content is unknown. */
  royalValue: number | null;
  gain: number | null;
};

/**
 * Values one package. `unitPrice(name)` is the market gold per unit (null when
 * unknown); `goldPer100` is the in-game crystal exchange rate, or null when
 * the player has not entered it.
 */
export function packageValue(
  pkg: ShopPackage,
  unitPrice: (name: string) => number | null,
  goldPer100: number | null,
  royalPer100 = SHOP_DATA.crystal.royalPer100,
): PackageValue {
  const { purchases, sets, priceRoyal } = purchasePlan(pkg);
  const items = pkg.items.map((item): ItemValue => {
    const total = item.qty * sets;
    const unit = item.kind === "crystal" ? (goldPer100 == null ? null : goldPer100 / 100) : unitPrice(item.name);
    return { ...item, total, unit, gold: unit == null ? null : total * unit };
  });
  const known = items.filter((i) => i.gold != null);
  const unknown = items.filter((i) => i.gold == null);
  const gold = known.reduce((sum, i) => sum + (i.gold as number), 0);
  const crystals = items.filter((i) => i.kind === "crystal").reduce((sum, i) => sum + i.total, 0);
  const royalValue = goldPer100 && goldPer100 > 0 && !unknown.length ? (gold * royalPer100) / goldPer100 : null;
  return {
    purchases,
    sets,
    priceRoyal,
    items,
    gold,
    unknown,
    crystalsForPrice: Math.floor((priceRoyal * 100) / royalPer100),
    crystals,
    royalValue,
    gain: royalValue == null ? null : royalValue - priceRoyal,
  };
}

/** The typed exchange rate: a positive whole number of gold, or null. */
export function parseRate(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const rate = Number(digits);
  return Number.isSafeInteger(rate) && rate > 0 ? rate : null;
}

/** Whether the data says the package is still on sale on `today` (KST date "YYYY-MM-DD"). */
/** Regular maintenance starts at 06:00 KST: "N일 정기 점검 전" ends then. */
export const MAINTENANCE_START_KST = "06:00:00";

/** Whether the package is still on sale at `now` (epoch ms): sales end when that day's maintenance starts. */
export const onSale = (pkg: ShopPackage, now: number) =>
  pkg.until == null || now < Date.parse(`${pkg.until}T${MAINTENANCE_START_KST}+09:00`);

/** Consistency problems in the data; the test suite expects none. */
export function checkShopData(data: ShopData): string[] {
  const problems: string[] = [];
  if (!data.sources[data.crystal.source]) problems.push("crystal: unknown source");
  for (const [key, s] of Object.entries(data.sources))
    if (!s.url.startsWith("https://lostark.game.onstove.com/")) problems.push(`${key}: not an official page`);
  const ids = new Set<string>();
  for (const p of data.packages) {
    if (ids.has(p.id)) problems.push(`${p.id}: duplicate`);
    ids.add(p.id);
    if (!data.sources[p.source]) problems.push(`${p.id}: unknown source`);
    if (!Number.isInteger(p.priceRoyal) || p.priceRoyal <= 0) problems.push(`${p.id}: bad price`);
    if (!p.items.length) problems.push(`${p.id}: no items`);
    for (const i of p.items) if (!Number.isInteger(i.qty) || i.qty <= 0) problems.push(`${p.id}: bad qty ${i.name}`);
    if (p.until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(p.until)) problems.push(`${p.id}: bad until`);
  }
  return problems;
}
