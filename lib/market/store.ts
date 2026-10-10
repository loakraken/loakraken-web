"use client";

import { create } from "zustand";
import {
  MAX_QUOTE_ITEMS,
  parseQuantity,
  type MarketPriceItem,
  type MarketSearch,
  type PriceBasis,
  type QuoteRequest,
} from "./model";

// Planner inputs only (UI state). Server results stay in TanStack Query.
export type PlanRow = {
  item: MarketPriceItem;
  search: MarketSearch;
  required: string;
  owned: string;
};

type PlanState = {
  basis: PriceBasis;
  rows: PlanRow[];
  setBasis: (basis: PriceBasis) => void;
  add: (item: MarketPriceItem, search: MarketSearch) => boolean;
  remove: (itemId: number) => void;
  setQuantity: (
    itemId: number,
    field: "required" | "owned",
    value: string,
  ) => void;
};

export const usePlan = create<PlanState>((set, get) => ({
  basis: "CURRENT_MIN_PRICE",
  rows: [],
  setBasis: (basis) => set({ basis }),
  add: (item, search) => {
    const { rows } = get();
    if (
      rows.length >= MAX_QUOTE_ITEMS ||
      rows.some((row) => row.item.id === item.id)
    )
      return false;
    set({ rows: [...rows, { item, search, required: "", owned: "0" }] });
    return true;
  },
  remove: (itemId) =>
    set(({ rows }) => ({ rows: rows.filter((row) => row.item.id !== itemId) })),
  setQuantity: (itemId, field, value) =>
    set(({ rows }) => ({
      rows: rows.map((row) =>
        row.item.id === itemId ? { ...row, [field]: value } : row,
      ),
    })),
}));

/** Null while any quantity is not a valid whole number. */
export function toQuoteRequest(
  basis: PriceBasis,
  rows: PlanRow[],
): QuoteRequest | null {
  if (!rows.length) return null;
  const items = [];
  for (const row of rows) {
    const requiredQuantity = parseQuantity(row.required);
    const ownedQuantity = parseQuantity(row.owned);
    if (requiredQuantity === null || ownedQuantity === null) return null;
    items.push({
      itemId: row.item.id,
      requiredQuantity,
      ownedQuantity,
      search: row.search,
    });
  }
  return { priceBasis: basis, items };
}
