import type { Metadata } from "next";
import { ContributionTool } from "@/components/tools/contribution";

export const metadata: Metadata = {
  title: "기여도 계산기",
  description: "레이드 관문마다 내 피해량이 하한과 상한 사이 어디쯤인지 보여 줍니다.",
  alternates: { canonical: "/tools/contribution" },
};

export default function ContributionPage() {
  return <ContributionTool />;
}
