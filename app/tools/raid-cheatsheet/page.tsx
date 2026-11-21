import type { Metadata } from "next";
import { connection } from "next/server";
import { RaidCheatSheet } from "@/components/tools/raid-cheatsheet";

export const metadata: Metadata = {
  title: "레이드 컨닝페이퍼",
  description: "레이드 관문마다 주요 패턴의 동작과 대응, 나오는 HP 줄 구간을 한 장으로 보여 줍니다.",
  alternates: { canonical: "/tools/raid-cheatsheet" },
};

export default async function RaidCheatSheetPage() {
  // Rendered per request: the raid, difficulty and gate kept in the address (M51) are in the first HTML.
  await connection();
  return <RaidCheatSheet />;
}
