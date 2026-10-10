"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchItemTooltips } from "@/lib/character/client";

/**
 * The tooltips' remaining lines (durability, restrictions, sources), fetched
 * once the page is idle after hydration so they never compete with the first
 * paint; the cards render from the search response until then (PM 18:28).
 */
export function useItemTooltips(name: string) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setIdle(true), { timeout: 2_000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setIdle(true), 300);
    return () => window.clearTimeout(id);
  }, []);
  return useQuery({
    queryKey: ["character-item-tooltips", name],
    queryFn: ({ signal }) => fetchItemTooltips(name, signal),
    enabled: idle,
    staleTime: 5 * 60_000,
    retry: false,
  }).data?.data;
}
