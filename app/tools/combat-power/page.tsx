import type { Metadata } from "next";
import { NOT_FOUND_METADATA } from "@/lib/not-found-metadata";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { CombatPowerTool } from "@/components/tools/combat-power";
import { characterNameError, normalizeCharacterName } from "@/lib/character/model";
import { isSearchBot } from "@/lib/character/public-summary";
import { getCharacter } from "@/lib/character/server";
import { getCombatPowerOptions } from "@/lib/combat-power/server";
import {
  isArkGemSimEnabled,
  isArmorCpSimEnabled,
  isCharacterEfficiencyEnabled,
  isCombatPowerEnabled,
  isGemRankingEnabled,
  isKarmaSimEnabled,
} from "@/lib/tools/flags";

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
  const tool = (
    <CombatPowerTool
      initialName={name}
      karma={isKarmaSimEnabled()}
      armor={isArmorCpSimEnabled()}
      gem={isArkGemSimEnabled()}
      efficiency={isCharacterEfficiencyEnabled()}
      gemRanking={isGemRankingEnabled()}
    />
  );
  // The simulator's first screen (its editors and notes) waited on the character and options requests, which the
  // client could only send after every script had loaded and hydrated: LCP 3.1–3.2s at 320 · CPU 4× · Slow 4G
  // (#1949). With a name in the address both come from here, under the same query keys, as the character page
  // does; a failed or slow answer leaves the query empty and the client asks as before. No backend call for a
  // search bot (the character page's rule).
  const target = name && !characterNameError(name) ? normalizeCharacterName(name) : "";
  if (!target || isSearchBot((await headers()).get("user-agent"))) return tool;
  const [result, options] = await Promise.all([
    // 1.2 s (#1959, review P3 on #1950): a slow backend holds the first HTML no longer than that; past it the client
    // asks as before. A cached character answers well inside it.
    getCharacter(target, AbortSignal.timeout(1_200)),
    getCombatPowerOptions(AbortSignal.timeout(1_000)),
  ]);
  // Request-time snapshot in a dynamic Server Component, shared with hydration.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();
  const client = new QueryClient();
  if (result.ok) client.setQueryData(["character", target], result.envelope, { updatedAt: renderedAt });
  if (options.ok) client.setQueryData(["combat-power-options"], options.envelope, { updatedAt: renderedAt });
  return <HydrationBoundary state={dehydrate(client)}>{tool}</HydrationBoundary>;
}
