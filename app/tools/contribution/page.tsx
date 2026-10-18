import type { Metadata } from "next";
import { connection } from "next/server";
import { ContributionTool } from "@/components/tools/contribution";

export const metadata: Metadata = {
  title: "기여도 계산기",
  description: "레이드 관문마다 내 피해량이 하한과 상한 사이 어디쯤인지 보여 줍니다.",
  alternates: { canonical: "/tools/contribution" },
};

export default async function ContributionPage() {
  // Rendered per request: the inputs kept in the address (#889) are in the first HTML.
  await connection();
  return <ContributionTool />;
}
