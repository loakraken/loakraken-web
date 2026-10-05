import type { Metadata } from "next";
import { RefiningPlanTool } from "@/components/tools/refining-plan";

export const metadata: Metadata = {
  title: "재련 기대 비용",
  description:
    "운명의 업화·전율 장비의 현재 단계부터 목표 단계까지 평균·50%·90%·장인의 기운 기준 시도 횟수와 재료, 재련 골드를 계산합니다.",
};

export default async function RefiningPage({
  searchParams,
}: {
  searchParams: Promise<{ character?: string | string[] }>;
}) {
  const { character } = await searchParams;
  const name = typeof character === "string" ? character.slice(0, 64) : "";
  return <RefiningPlanTool initialName={name} />;
}
