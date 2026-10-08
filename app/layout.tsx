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
  title: { default: "LOAKraken — 정밀 관측으로 결정하는 다음 성장", template: "%s | LOAKraken" },
  description: "흩어진 로스트아크 캐릭터 정보를 한눈에. 장비와 세팅, 관측한 데이터와 진단의 근거를 함께 확인하세요.",
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
