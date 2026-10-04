"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";

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
                retry: 1,
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