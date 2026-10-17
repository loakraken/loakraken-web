import type { Metadata } from "next";
import { HomeworkLoader } from "@/components/tools/homework-loader";

export const metadata: Metadata = {
  title: "숙제 체크",
  description:
    "원정대를 불러와 캐릭터별 주간 레이드 관문·더보기를 체크하고, 이번 주 받은 골드와 받을 수 있는 골드(거래 가능·귀속)를 계산합니다. 브라우저에 저장됩니다.",
  alternates: { canonical: "/tools/homework" },
};

export default function HomeworkPage() {
  return <HomeworkLoader />;
}
