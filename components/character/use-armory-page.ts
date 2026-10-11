"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchArmoryPage } from "@/lib/character/client";

/**
 * Official armory page details (tripod levels, skill code), loaded when the
 * page is idle like the tooltip lines. Only an enabled answer is returned:
 * with the backend flag off (enabled: false), a failure or no cache, the
 * screen shows nothing extra and keeps no space for it.
 */
export function useArmoryPage(name: string) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setIdle(true), { timeout: 2_000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setIdle(true), 300);
    return () => window.clearTimeout(id);
  }, []);
  const page = useQuery({
    queryKey: ["character-armory-page", name],
    queryFn: ({ signal }) => fetchArmoryPage(name, signal),
    enabled: idle,
    staleTime: 5 * 60_000,
    retry: false,
  }).data?.data;
  return page?.enabled ? page : undefined;
}
