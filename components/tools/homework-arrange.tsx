"use client";
// Bencho "Reorder list" with its motion features, loaded when "순서 바꾸기"
// first opens (PM-프론트 #483 P1). Its rows take the keyboard too (↑↓ or
// Alt+↑↓, change 9 in the block), the same moves as the raid cards below.
import type { ComponentProps } from "react";
import { LazyMotion } from "motion/react";
import { Arrange } from "@/components/ui/bencho/reorder-list";

const loadFeatures = () => import("@/lib/motion-dom-animation").then((mod) => mod.default);

export default function HomeworkArrange(props: ComponentProps<typeof Arrange>) {
  return (
    <LazyMotion features={loadFeatures}>
      <Arrange {...props} />
    </LazyMotion>
  );
}
