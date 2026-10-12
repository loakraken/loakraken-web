import type { Metadata } from "next";
import { RaidCheatSheet } from "@/components/tools/raid-cheatsheet";

export const metadata: Metadata = {
  title: "레이드 컨닝페이퍼",
  description: "레이드 관문마다 주요 패턴의 동작과 대응, 나오는 HP 줄 구간을 한 장으로 보여 줍니다.",
};

export default function RaidCheatSheetPage() {
  return <RaidCheatSheet />;
}
