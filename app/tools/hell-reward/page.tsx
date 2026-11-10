import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HellRewardTool } from "@/components/tools/hell-reward";
import { NOT_FOUND_METADATA } from "@/lib/not-found-metadata";
import { isHellRewardEnabled } from "@/lib/tools/flags";

const metadata: Metadata = {
  title: "지옥 · 나락 보상",
  description: "지옥 · 나락 열쇠 단계별 고정 보상을 지금 거래소 시세와 직접 정한 값으로 매겨 단계마다 비교합니다.",
  alternates: { canonical: "/tools/hell-reward" },
};

// Hidden by its switch: the 404's title, not this tool's name.
export function generateMetadata(): Metadata {
  return isHellRewardEnabled() ? metadata : NOT_FOUND_METADATA;
}

export default async function HellRewardPage() {
  if (!isHellRewardEnabled()) notFound();
  // Rendered per request: the choices kept in the address (#889) are in the first HTML.
  await connection();
  return <HellRewardTool />;
}
