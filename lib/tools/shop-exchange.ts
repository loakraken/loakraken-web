// (ours, M50) 상점 교환 효율: the standing shops (레이드 재화 · 싱글 · 길드 혈석), each row valued in gold per 1 of the
// shop's currency. Market items take the official market price (our market path); a box without published contents
// or odds, a choice box, a bound item or an item with no market price takes the user's own value (no default), and
// is ranked only once it has one. A row whose data is not confirmed yet ('checking': an inferred pouch size, a limit
// cut off on the source screen) is shown but never ranked. Sources stay in the data file; the screen shows the date.
import raw from "./data/shop-exchange.json";
import { sourceUrlOk, type SourceUrl } from "./source-url";

/** DIRECT = a market item (price × units) · BOX = random box, contents/odds unpublished · CHOICE = pick-one box · BOUND = bound/unpriced item. */
export type ShopBasis = "DIRECT" | "BOX" | "CHOICE" | "BOUND";
export type ShopLimit = { count: number; roster: boolean } | null;
export type ShopRow = {
  id: string;
  item: string;
  qty: number;
  currency: string;
  cost: number;
  /** null = no limit (or, with `checking`, not known yet). Weekly otherwise. */
  limit: ShopLimit;
  basis: ShopBasis;
  /** The market item a DIRECT row is priced by. */
  market?: string;
  /** Market units in one of the row's item (a pouch or box of that item); inferred sizes come with `checking`. */
  perItem?: number;
  /** Why the row is not confirmed yet: shown, never ranked. */
  checking?: string;
  note?: string;
  source: string;
};
export type Shop = { id: string; name: string; limitNote: string; rows: ShopRow[] };
export type ShopSource = SourceUrl & { title: string; date: string; kind: string };
export type ShopData = { version: string; sources: Record<string, ShopSource>; shops: Shop[] };

export const SHOP_DATA = raw as ShopData;

/** The date the row's source was checked ('2026-11-22'), shown on every row. */
export const rowDate = (row: ShopRow, data: ShopData = SHOP_DATA) => data.sources[row.source]?.date ?? "";

/** Consistency problems; the test suite expects none. */
export function checkShopData(data: ShopData): string[] {
  const problems: string[] = [];
  for (const [id, source] of Object.entries(data.sources)) {
    if (!sourceUrlOk(source)) problems.push(`source ${id}: url must be https (or null with its internal-record note)`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.date)) problems.push(`source ${id}: bad date`);
  }
  const ids = new Set<string>();
  for (const shop of data.shops)
    for (const row of shop.rows) {
      if (ids.has(row.id)) problems.push(`${row.id}: duplicate id`);
      ids.add(row.id);
      if (!data.sources[row.source]) problems.push(`${row.id}: unknown source`);
      if (!Number.isInteger(row.qty) || row.qty <= 0) problems.push(`${row.id}: bad qty`);
      if (!Number.isInteger(row.cost) || row.cost <= 0) problems.push(`${row.id}: bad cost`);
      if (row.limit && (!Number.isInteger(row.limit.count) || row.limit.count <= 0)) problems.push(`${row.id}: bad limit`);
      if ((row.basis === "DIRECT") !== !!row.market) problems.push(`${row.id}: a market name exactly on DIRECT rows`);
      if (row.perItem !== undefined && !row.checking) problems.push(`${row.id}: an inferred size must be marked checking`);
      if (row.checking !== undefined && !row.checking.trim()) problems.push(`${row.id}: empty checking reason`);
    }
  return problems;
}

/** Names to ask the market for: every DIRECT row's item and every shop currency (for the cart's net value). */
export function shopMarketNames(data: ShopData = SHOP_DATA): string[] {
  const names = new Set<string>();
  for (const shop of data.shops)
    for (const row of shop.rows) {
      if (row.market) names.add(row.market);
      names.add(row.currency);
    }
  return [...names];
}

/** Gold for 1 unit of a market item, or null (no price, untradeable). */
export type UnitPrice = (name: string) => number | null;
/** The user's own values, gold for 1 of the item named by `valueKey`. */
export type UserValues = Readonly<Record<string, number>>;

/** What a user value is for: the market item for an unpriced DIRECT row (per unit), else the row's item (per 1). */
export const valueKey = (row: ShopRow) => row.market ?? row.item;

export type RowValue =
  | { state: "CHECKING"; reason: string }
  | { state: "NEEDS_VALUE"; key: string; why: ShopBasis | "NO_PRICE" }
  | { state: "OK"; gold: number; perCurrency: number; from: "MARKET" | "USER" };

/** The row's gold value for one exchange, and per 1 currency. */
export function rowValue(row: ShopRow, price: UnitPrice, values: UserValues): RowValue {
  if (row.checking) return { state: "CHECKING", reason: row.checking };
  const units = row.qty * (row.perItem ?? 1);
  const key = valueKey(row);
  const ok = (gold: number, from: "MARKET" | "USER"): RowValue => ({ state: "OK", gold, perCurrency: gold / row.cost, from });
  if (row.basis === "DIRECT") {
    const unit = row.market ? price(row.market) : null;
    if (unit != null) return ok(units * unit, "MARKET");
    const own = values[key];
    return own != null && own > 0 ? ok(units * own, "USER") : { state: "NEEDS_VALUE", key, why: "NO_PRICE" };
  }
  const own = values[key];
  return own != null && own > 0 ? ok(units * own, "USER") : { state: "NEEDS_VALUE", key, why: row.basis };
}

export type RankedRow = { row: ShopRow; value: RowValue; rank: number | null };

/**
 * One shop's rows: those with a value first, best gold per currency first (the data order on a tie), numbered;
 * then the rows waiting for a value, then the rows being checked — both in the data order, unnumbered.
 */
export function rankShop(shop: Shop, price: UnitPrice, values: UserValues): RankedRow[] {
  const all = shop.rows.map((row) => ({ row, value: rowValue(row, price, values) }));
  const valued = all
    .filter((r) => r.value.state === "OK")
    .sort((a, b) => (b.value as { perCurrency: number }).perCurrency - (a.value as { perCurrency: number }).perCurrency)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const waiting = all.filter((r) => r.value.state === "NEEDS_VALUE").map((r) => ({ ...r, rank: null }));
  const checking = all.filter((r) => r.value.state === "CHECKING").map((r) => ({ ...r, rank: null }));
  return [...valued, ...waiting, ...checking];
}

/**
 * A row's name for its buttons and fields: item, cost and currency. One item can sit in a shop at two price steps
 * (길드 690 / 770 혈석), so the item alone does not tell rows apart (codex P2 on #1928); unique over the data (test).
 */
export const rowName = (row: ShopRow) => `${row.item} ${row.cost.toLocaleString("ko-KR")} ${row.currency}`;

/** How many times a row can go in the cart: its weekly limit, or 99 when there is none. */
export const cartMax = (row: ShopRow) => row.limit?.count ?? 99;

export type CartSummary = {
  lines: number;
  /** Currency → total spent, in the cart's order of first appearance. */
  spend: { currency: string; cost: number; gold: number; perCurrency: number | null }[];
  /** Gold value of the lines that have one. */
  gold: number;
  /** Lines without a value yet (checking, or waiting for the user's value): left out of the gold. */
  unvalued: number;
  /** The currencies' own market value, where they have one: what the exchange gives up. */
  currencyGold: number;
  unpricedCurrencies: string[];
  /** gold − currencyGold: the value gained over selling the currency (currencies with no price count as 0). */
  net: number;
};

/** The cart: row id → times (clamped to 1..its limit), over all shops. */
export function cartSummary(
  cart: Readonly<Record<string, number>>,
  price: UnitPrice,
  values: UserValues,
  data: ShopData = SHOP_DATA,
): CartSummary {
  const rows = new Map(data.shops.flatMap((shop) => shop.rows.map((row) => [row.id, row] as const)));
  const spend = new Map<string, { cost: number; gold: number; unvalued: boolean }>();
  let gold = 0;
  let unvalued = 0;
  let lines = 0;
  for (const [id, wanted] of Object.entries(cart)) {
    const row = rows.get(id);
    if (!row || !(wanted > 0)) continue;
    const times = Math.min(Math.floor(wanted), cartMax(row));
    lines += 1;
    const value = rowValue(row, price, values);
    const entry = spend.get(row.currency) ?? { cost: 0, gold: 0, unvalued: false };
    entry.cost += row.cost * times;
    if (value.state === "OK") {
      gold += value.gold * times;
      entry.gold += value.gold * times;
    } else {
      unvalued += 1;
      entry.unvalued = true;
    }
    spend.set(row.currency, entry);
  }
  let currencyGold = 0;
  const unpricedCurrencies: string[] = [];
  for (const [currency, entry] of spend) {
    const unit = price(currency);
    if (unit == null) unpricedCurrencies.push(currency);
    else currencyGold += unit * entry.cost;
  }
  return {
    lines,
    spend: [...spend].map(([currency, entry]) => ({
      currency,
      cost: entry.cost,
      gold: entry.gold,
      perCurrency: entry.unvalued || entry.cost === 0 ? null : entry.gold / entry.cost,
    })),
    gold,
    unvalued,
    currencyGold,
    unpricedCurrencies,
    net: gold - currencyGold,
  };
}

/** What the value field says when its text is not a value (kept as typed, not saved; codex P2 on #1928, as #1889). */
export const VALUE_INVALID = "0보다 큰 숫자로 넣어 주세요. 넣은 값은 저장하지 않았어요.";

/**
 * A typed value in gold: empty clears it (null); digits with optional thousands commas and decimals, above 0, are a
 * value; anything else ('-100', '1..2', '1,0,0', '12abc') is invalid and changes nothing saved.
 */
export function parseUserGold(text: string): { ok: true; value: number | null } | { ok: false } {
  const t = text.trim();
  if (t === "") return { ok: true, value: null };
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(t)) return { ok: false };
  const value = Number(t.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? { ok: true, value } : { ok: false };
}
