import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CritSpeedTool } from "@/components/tools/crit-speed";
import { isCritSpeedEnabled } from "@/lib/tools/flags";

export const metadata: Metadata = {
  title: "치적·뭉가·음돌 계산",
  description:
    "캐릭터의 치명타 적중률과 공격·이동 속도를 캐릭터 값과 파티·버프 가정으로 나눠 계산하고, 뭉툭한 가시·음속 돌파 목표까지 필요한 치명·신속을 알려줍니다.",
  alternates: { canonical: "/tools/crit-speed" },
};

export default async function CritSpeedPage({
  searchParams,
}: {
  searchParams: Promise<{ character?: string | string[] }>;
}) {
  const { character } = await searchParams;
  if (!isCritSpeedEnabled()) notFound();
  const name = typeof character === "string" ? character.slice(0, 64) : "";
  return <CritSpeedTool initialName={name} />;
}
