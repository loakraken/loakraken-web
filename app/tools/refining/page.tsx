import type { Metadata } from "next";
import { RefiningPlanTool } from "@/components/tools/refining-plan";
import { isRefiningAdvancedEnabled, isSpecialStoneEnabled } from "@/lib/tools/flags";

export const metadata: Metadata = {
  title: "재련 기대 비용",
  description:
    "운명의 업화·전율 장비의 현재 단계부터 목표 단계까지 평균·50%·90%·장인의 기운 기준 시도 횟수와 재료, 재련 골드를 계산합니다.",
  alternates: { canonical: "/tools/refining" },
};

export default async function RefiningPage({
  searchParams,
}: {
  searchParams: Promise<{ character?: string | string[] }>;
}) {
  const { character } = await searchParams;
  const name = typeof character === "string" ? character.slice(0, 64) : "";
  // 상급 재련 +10 (X3 part 2, web #1951): REFINING_ADVANCED; 특수 재련 돌파석 가치 (M42): SPECIAL_STONE. Off unless set on.
  return <RefiningPlanTool initialName={name} advanced={isRefiningAdvancedEnabled()} special={isSpecialStoneEnabled()} />;
}
