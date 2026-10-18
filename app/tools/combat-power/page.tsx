import type { Metadata } from "next";
import { NOT_FOUND_METADATA } from "@/lib/not-found-metadata";
import { notFound } from "next/navigation";
import { CombatPowerTool } from "@/components/tools/combat-power";
import { isCombatPowerEnabled } from "@/lib/tools/flags";

const metadata: Metadata = {
  title: "전투력 시뮬레이터",
  description:
    "캐릭터의 보석·재련·품질을 바꿨을 때 전투력이 얼마나 오르는지 항목별로 보여 줍니다.",
  alternates: { canonical: "/tools/combat-power" },
};

// Hidden by its switch: the 404's title, not this tool's name.
export function generateMetadata(): Metadata {
  return isCombatPowerEnabled() ? metadata : NOT_FOUND_METADATA;
}

export default async function CombatPowerPage({
  searchParams,
}: {
  searchParams: Promise<{ character?: string | string[] }>;
}) {
  const { character } = await searchParams;
  if (!isCombatPowerEnabled()) notFound();
  const name = typeof character === "string" ? character.slice(0, 64) : "";
  return <CombatPowerTool initialName={name} />;
}
