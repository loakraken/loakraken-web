"use client";
// 재료 견적에 담은 줄을 주소에 (#897, PM-프론트 #896 판단): only the item id,
// the search it was found with and the two quantities go into the address;
// the item itself (name, grade, icon, prices) is read again on open. Reload
// and a shared link come back with the same lines; a line whose item cannot
// be found again is counted, not shown empty.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { writeUrlParam } from "../tools/url-state";
import { fetchMarketItems } from "./client";
import { MAX_QUOTE_ITEMS } from "./model";
import { usePlan, type PlanRow } from "./store";

const KEY = "items";

type Saved = { id: number; c: number; n: string; p: number; r: string; o: string };

const short = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const whole = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v > 0;

/** The address's lines, each field checked; anything malformed is dropped. */
export function parseSavedRows(raw: string | null): Saved[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const out: Saved[] = [];
  for (const v of value.slice(0, MAX_QUOTE_ITEMS)) {
    if (!v || typeof v !== "object") continue;
    const s = v as Record<string, unknown>;
    if (whole(s.id) && whole(s.c) && short(s.n, 40) && whole(s.p) && short(s.r, 12) && short(s.o, 12))
      out.push({ id: s.id as number, c: s.c as number, n: s.n as string, p: s.p as number, r: s.r as string, o: s.o as string });
  }
  return out;
}

export const formatSavedRows = (rows: PlanRow[]) =>
  rows.length
    ? JSON.stringify(
        rows.map((row) => ({
          id: row.item.id,
          c: row.search.categoryCode,
          n: row.search.itemName,
          p: row.search.pageNo,
          r: row.required,
          o: row.owned,
        })),
      )
    : null;

/**
 * Brings the address's lines back into the plan once (when the plan is empty:
 * coming back inside the app keeps the store as it was), then keeps the
 * address in step with the plan. While the lines load, nothing is written,
 * so the address is not emptied before they arrive.
 */
export function usePlanInAddress() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [saved] = useState(() => parseSavedRows(params.get(KEY)));
  const rows = usePlan((state) => state.rows);
  const [loading, setLoading] = useState(() => saved.length > 0 && usePlan.getState().rows.length === 0);
  const [missing, setMissing] = useState(0);

  useEffect(() => {
    if (!loading) return;
    let stale = false;
    const wanted = saved;
    // One request per search the lines were found with (several lines often share one).
    const searches = new Map<string, Saved>();
    for (const s of wanted) searches.set(`${s.c}|${s.n}|${s.p}`, s);
    Promise.all(
      [...searches.values()].map((s) =>
        // The same key and freshness as the search box's own query, so a
        // search typed again right after reuses this answer (pf-ensure-query-data).
        queryClient
          .fetchQuery({
            queryKey: ["market", "items", { categoryCode: s.c, itemName: s.n, pageNo: s.p }],
            queryFn: ({ signal }) => fetchMarketItems({ categoryCode: s.c, itemName: s.n, pageNo: s.p }, signal),
            staleTime: 30_000,
          })
          .then((envelope) => envelope.data.items)
          .catch(() => []),
      ),
    ).then((lists) => {
      if (stale) return;
      const items = new Map(lists.flat().map((item) => [item.id, item]));
      const back: PlanRow[] = [];
      for (const s of wanted) {
        const item = items.get(s.id);
        if (item)
          back.push({ item, search: { categoryCode: s.c, itemName: s.n, pageNo: s.p }, required: s.r, owned: s.o });
      }
      // Lines the user added meanwhile stay; the brought-back ones go first.
      const added = usePlan.getState().rows.filter((row) => !back.some((b) => b.item.id === row.item.id));
      usePlan.setState({ rows: [...back, ...added].slice(0, MAX_QUOTE_ITEMS) });
      setMissing(wanted.length - back.length);
      setLoading(false);
    });
    return () => {
      stale = true;
    };
  }, [loading, saved, queryClient]);

  useEffect(() => {
    if (loading) return;
    writeUrlParam(KEY, formatSavedRows(rows));
  }, [rows, loading]);

  return { loading, missing };
}
