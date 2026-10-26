"use client";

import { useQuery } from "@tanstack/react-query";
import type { NavFlag, NavFlags } from "./nav-data";

/**
 * Runtime flags for menu entries and hub tabs. They are read per request on
 * the server (the image is promoted from staging to production, and some pages
 * are static HTML), so the page asks once (one cache entry for the menu and
 * the tabs); a flagged entry stays out until the answer says it is on.
 */
export function useNavFlags(): NavFlags {
  const query = useQuery({
    queryKey: ["nav-flags"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/flags", { signal });
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as NavFlags;
    },
    staleTime: Infinity,
  });
  return query.data ?? {};
}

export const visible = (item: { flag?: NavFlag }, flags: NavFlags) => !item.flag || flags[item.flag] === true;
