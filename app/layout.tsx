import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";

import "./globals.css";
import Providers from "./providers";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { themeInitScript } from "@/components/ui/theme-toggle";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const korean = Noto_Sans_KR({
  variable: "--font-korean",
  subsets: ["latin"],
  display: "swap",
});

const TITLE = "LOAKraken — 로스트아크 캐릭터 정보·시세·성장 도구";
const DESCRIPTION =
  "로스트아크 캐릭터 검색, 장비·아크 그리드·각인, 거래소 시세, 재련·치적 계산기를 한곳에서.";

// Base URL per request (SITE_URL); pages rendered at build time get the
// production domain. Each page sets its own canonical.
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: TITLE, template: "%s | LOAKraken" },
    description: DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: {
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "website",
      title: TITLE,
      description: DESCRIPTION,
    },
    twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
  };
}

export default function RootLayout({ children }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The pre-paint script sets data-theme before hydration (stored dark choice).
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistMono.variable} ${korean.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
