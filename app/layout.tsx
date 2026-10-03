import type { Metadata } from "next";
import "./globals.css";

import { TooltipProvider } from "@/components/ui/tooltip";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "LOAKraken",
  description: "Lost Ark Data Intelligence Platform",
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="ko">
      <body>
      <Providers>
        <TooltipProvider>{children}</TooltipProvider>
      </Providers>
      </body>
      </html>
  );
}