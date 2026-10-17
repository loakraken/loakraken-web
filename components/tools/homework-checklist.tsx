"use client";
// Bencho "Checklist" in a chunk of its own: the homework page loads it only
// when a character is on screen (PM-프론트 #483 P1, first-load JS budget) and
// holds the same height until it arrives. The block runs without the motion
// library (see ./static-motion in the block), so no LazyMotion here.
import { Checklist, type ChecklistItem } from "@/components/ui/bencho/checklist";

export default function HomeworkChecklist(props: {
  items: ChecklistItem[];
  onToggle: (index: number) => void;
}) {
  return <Checklist width="100%" addable={false} fall={false} {...props} />;
}
