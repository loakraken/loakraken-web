// 로아샵 효율 (checklist L45): an in-game shop package's contents valued at
// today's market prices, against its price in royal crystals. Formula
// confirmed by calc verification (2026-10-12):
//   gold value   = Σ ⌈qty × unit price⌉ per content line (market price ÷
//                  bundle size; a line within float error of a whole number
//                  is rounded instead — the comparison basis, 2026-10-14)
//   royal value  = gold × 2,750 ÷ (gold for 100 crystals at the in-game
//                  crystal exchange)  — 100 crystals = 2,750 royal crystals
//                  at the official shop (크리스탈 [200개] = 5,500)
//   gain         = royal value − package price
// Only the official path (royal → crystal → in-game exchange gold) is used;
// no off-game rate exists here (PM 총괄 2026-10-13). The exchange rate is
// typed by the player from the game and stays in this browser. Contents
// without a market price are "미확인", never 0, and block the gain; contents
// that cannot be traded at all (the price API's UNTRADEABLE) are left out of
// the gold and the gain is still computed (PM 총괄 2026-10-14, as on the
// comparison basis). 페온 is handled the same way: it has no market and no
// sourced gold value, so it is left out and named ("페온 n개 제외"); a package
// with nothing but 페온 is not valued at all (PM 총괄 2026-10-14, P3). Static data in
// data/loa-shop.json, from the official shop notices.
import raw from "./data/loa-shop.json";

export type ShopItem = {
  /** pheon: no market and no gold value; left out of the gold. */
  kind: "market" | "crystal" | "pheon";
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
  /**
   * When the sale ends, KST, from the notice: "N일 정기 점검 전" is that
   * Wednesday's maintenance start, 06:00 KST. null while "별도 안내 시".
   */
  endsAt: string | null;
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

/** What `unitPrice` returns for a content that cannot be traded on the market. */
export const UNTRADEABLE = "untradeable" as const;
export type UnitPrice = number | null | typeof UNTRADEABLE;

export type ItemValue = ShopItem & {
  /** Cannot be traded: left out of the gold, does not block the gain. */
  untradeable: boolean;
  /** 페온: left out of the gold, does not block the gain. */
  pheon: boolean;
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
  /** Contents left out of `gold` because their value is unknown (these block the gain). */
  unknown: ItemValue[];
  /** Contents left out of `gold` because they cannot be traded. */
  untradeable: ItemValue[];
  /** 페온 contents, left out of `gold`. */
  pheon: ItemValue[];
  /** Nothing but 페온: no gold to value, so no gain either. */
  onlyPheon: boolean;
  /** Crystals the same royal crystals would buy at the official shop. */
  crystalsForPrice: number;
  /** Crystals inside the package. */
  crystals: number;
  /** null without an exchange rate, or while any content is unknown. */
  royalValue: number | null;
  gain: number | null;
};

/**
 * Gold of one content line: rounded up to whole gold, except that a total
 * within float error of a whole number (|x − round(x)| ≤ ε|x|) is that number,
 * so 1.1 × 100 = 110.00000000000001 stays 110 while 274.3 becomes 275.
 * null when not finite (comparison basis, calc verification 2026-10-14).
 */
export function lineGold(x: number): number | null {
  if (!Number.isFinite(x)) return null;
  return Math.abs(x - Math.round(x)) <= Number.EPSILON * Math.abs(x) ? Math.round(x) : Math.ceil(x);
}

/**
 * Values one package. `unitPrice(name)` is the market gold per unit, null when
 * unknown, or UNTRADEABLE when it cannot be traded at all; `goldPer100` is the in-game crystal exchange rate, or null when
 * the player has not entered it.
 */
export function packageValue(
  pkg: ShopPackage,
  unitPrice: (name: string) => UnitPrice,
  goldPer100: number | null,
  royalPer100 = SHOP_DATA.crystal.royalPer100,
): PackageValue {
  const { purchases, sets, priceRoyal } = purchasePlan(pkg);
  const items = pkg.items.map((item): ItemValue => {
    const total = item.qty * sets;
    if (item.kind === "pheon") return { ...item, total, untradeable: false, pheon: true, unit: null, gold: null };
    const price = item.kind === "crystal" ? (goldPer100 == null ? null : goldPer100 / 100) : unitPrice(item.name);
    if (price === UNTRADEABLE) return { ...item, total, untradeable: true, pheon: false, unit: null, gold: null };
    // A unit price of 0 or less is unknown, never counted as 0.
    const unit = price != null && Number.isFinite(price) && price > 0 ? price : null;
    return { ...item, total, untradeable: false, pheon: false, unit, gold: unit == null ? null : lineGold(total * unit) };
  });
  const known = items.filter((i) => i.gold != null);
  const unknown = items.filter((i) => i.gold == null && !i.untradeable && !i.pheon);
  const untradeable = items.filter((i) => i.untradeable);
  const pheon = items.filter((i) => i.pheon);
  const onlyPheon = pheon.length > 0 && pheon.length === items.length;
  const gold = known.reduce((sum, i) => sum + (i.gold as number), 0);
  const crystals = items.filter((i) => i.kind === "crystal").reduce((sum, i) => sum + i.total, 0);
  const royalValue = goldPer100 && goldPer100 > 0 && !unknown.length && !onlyPheon ? (gold * royalPer100) / goldPer100 : null;
  return {
    purchases,
    sets,
    priceRoyal,
    items,
    gold,
    unknown,
    untradeable,
    pheon,
    onlyPheon,
    crystalsForPrice: Math.floor((priceRoyal * 100) / royalPer100),
    crystals,
    royalValue,
    gain: royalValue == null ? null : royalValue - priceRoyal,
  };
}

/**
 * Without a typed exchange rate (A23: never ask for a value the player may
 * not have; PM 총괄 2026-10-17): the in-game crystal exchange rate (gold per
 * 100 blue crystals) at or below which the package gains.
 *   value(rate) = (M + C × rate/100) × R/rate = M × R/rate + C × R/100
 *   gain ≥ 0 ⇔ rate ≤ M × R / (P − C × R/100)
 * M = gold of the market contents, C = crystals inside, P = price in royal
 * crystals, R = royal crystals per 100 crystals. "always" when the crystals
 * alone are worth the price, "never" with nothing tradeable to value; null
 * while a market content has no price, or for 페온 only.
 */
export type BreakEven = { kind: "rate"; rate: number } | { kind: "always" } | { kind: "never" };
export function breakEvenRate(
  pkg: ShopPackage,
  unitPrice: (name: string) => UnitPrice,
  royalPer100 = SHOP_DATA.crystal.royalPer100,
): BreakEven | null {
  const value = packageValue(pkg, unitPrice, null, royalPer100);
  if (value.onlyPheon || value.unknown.some((item) => item.kind !== "crystal")) return null;
  const rest = value.priceRoyal - (value.crystals * royalPer100) / 100;
  if (rest <= 0) return { kind: "always" };
  if (value.gold <= 0) return { kind: "never" };
  return { kind: "rate", rate: Math.floor((value.gold * royalPer100) / rest) };
}

/** The typed exchange rate: a positive whole number of gold, or null. */
export function parseRate(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const rate = Number(digits);
  return Number.isSafeInteger(rate) && rate > 0 ? rate : null;
}

/** Whether the package is still on sale at `now` (epoch ms). */
export const onSale = (pkg: ShopPackage, now: number) => pkg.endsAt == null || now < Date.parse(pkg.endsAt);

/** Packages on sale at `now`, and those whose sale has ended (kept, folded away on screen). */
export function splitBySale(packages: ShopPackage[], now: number) {
  return {
    current: packages.filter((p) => onSale(p, now)),
    past: packages.filter((p) => !onSale(p, now)),
  };
}

/** The list's place when nothing is on sale; points to the folded past items when there are any. */
export const shopEmptyCopy = (pastCount: number) =>
  pastCount > 0 ? "지금 판매 중인 패키지가 없어요. 지난 상품은 아래에서 볼 수 있어요." : "지금 판매 중인 패키지가 없어요.";

/**
 * Stale data: every package's sale has ended and nobody re-checked the official
 * shop notices since the last one ended (checkedAt is a KST date). The test suite
 * runs this against the real clock, so a forgotten weekly update fails it.
 */
export function staleShopData(data: ShopData, now: number): string | null {
  if (!data.packages.length || splitBySale(data.packages, now).current.length) return null;
  const lastEnd = Math.max(...data.packages.map((p) => Date.parse(p.endsAt as string)));
  const checked = Date.parse(`${data.checkedAt}T23:59:59+09:00`);
  return checked < lastEnd
    ? `every package ended (last ${new Date(lastEnd).toISOString()}) but checkedAt ${data.checkedAt} is before it: re-check the official shop notices and update lib/tools/data/loa-shop.json`
    : null;
}

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
    if (p.endsAt !== null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(p.endsAt)) problems.push(`${p.id}: bad endsAt`);
  }
  return problems;
}
