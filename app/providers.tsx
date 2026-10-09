"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { RATE_LIMITED, failureOf } from "@/lib/api/rate-limit";

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

  return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
  );
}