"use client";

import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { RATE_LIMITED, failureOf } from "@/lib/api/rate-limit";
import { replayEarlyClicks } from "@/lib/early-clicks";
import { listenForOpenTabs } from "@/lib/multi-search/share";

export default function Providers({
                                    children,
                                  }: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(
      () =>
          new QueryClient({
            defaultOptions: {
              queries: {
                staleTime: 60 * 1000,
                retry: (count, error) =>
                    failureOf(error)?.code !== RATE_LIMITED && count < 1,
                refetchOnWindowFocus: false,
              },
            },
          }),
  );

  // Runs after the whole page hydrated: taps made before that count now.
  useEffect(replayEarlyClicks, []);
  // Every page: the open tabs of the site share the last multi-search list.
  useEffect(listenForOpenTabs, []);
  return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
  );
}