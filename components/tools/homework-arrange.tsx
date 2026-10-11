"use client";
// Bencho "Reorder list" with its motion features, loaded when "순서 바꾸기"
// first opens (PM-프론트 #483 P1). The arrows and Alt+↑↓ do the same moves.
import { LazyMotion } from "motion/react";
import { Arrange, type ArrangeItem } from "@/components/ui/bencho/reorder-list";

const loadFeatures = () => import("@/lib/motion-dom-animation").then((mod) => mod.default);

export default function HomeworkArrange(props: { items: ArrangeItem[]; onReorder: (ids: string[]) => void }) {
  return (
    <LazyMotion features={loadFeatures}>
      <Arrange {...props} />
    </LazyMotion>
  );
}
