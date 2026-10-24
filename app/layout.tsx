import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

import "./globals.css";
import Providers from "./providers";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { siteVerification } from "@/lib/site-verification";
import { themeInitScript } from "@/components/ui/theme-toggle";
import { ThemeKeeper } from "@/components/ui/theme-keeper";
import { earlyClickScript } from "@/lib/early-clicks";
import { SiteLegal } from "@/components/site/site-legal";
import { PerRoute } from "@/components/site/per-route";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Pretendard Variable subset (KS X 1001 Hangul + ASCII, wght 400–700),
// renamed Kraken Sans per the OFL Reserved Font Name; licence in app/fonts.
// One preloaded file, so text re-lays out at most once (#300). No generated
// Arial fallback: it has no Hangul, so every glyph would go through system
// fallback lookup; the --font-ui stack names the system Hangul faces instead.
// display "optional": if the file is not there within the short block period,
// this visit keeps the system face and the cached file is used from the next
// page on — never a swap mid-read (with "fallback" a late file re-laid out
// text and tables by 26–48px, CLS 0.16 on /privacy; checklist A6).
const kraken = localFont({
  src: "./fonts/kraken-sans.woff2",
  variable: "--font-kraken",
  weight: "400 700",
  display: "optional",
  adjustFontFallback: false,
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
    // Ownership tags from the server env, production only (none when unset).
    verification: siteVerification(),
  };
}

export default function RootLayout({ children }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The pre-paint script sets data-theme before hydration (stored dark choice).
    <html lang="ko" className={`${geistMono.variable} ${kraken.variable}`} suppressHydrationWarning>
      {/* The two inline scripts open <body> instead of sitting in <head>: in
          <head> React had to hydrate them among the tags Next streams there
          (metadata, preloads), and when hydration started before a late
          preload landed it lost its place at <meta charset> and rebuilt the
          page (React #418 on /tools after another page, web #599). Here they
          still run before any of the page is parsed or painted. */}
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: earlyClickScript }} />
        <ThemeKeeper />
        <Providers>{children}</Providers>
        <PerRoute>
          <SiteLegal />
        </PerRoute>
      </body>
    </html>
  );
}
