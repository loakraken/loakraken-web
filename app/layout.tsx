import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";

import "./globals.css";
import Providers from "./providers";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const korean = Noto_Sans_KR({
  variable: "--font-korean",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "LOAKraken — 로스트아크 캐릭터 정보·시세·성장 도구", template: "%s | LOAKraken" },
  description: "로스트아크 캐릭터 검색, 장비·아크 그리드·각인, 거래소 시세, 재련·치적 계산기를 한곳에서.",
};

export default function RootLayout({ children }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ colorScheme: "light" }}>
      <body className={`${geistMono.variable} ${korean.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
