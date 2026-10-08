import type { Metadata } from "next";
import {
  StoneOptimizer,
  type StoneInitial,
} from "@/components/tools/stone-optimizer";
import {
  DECREASE_OPTIONS,
  DEFAULT_DECREASE,
  DEFAULT_GOALS,
  DEFAULT_SLOTS,
  MAX_GOALS,
  SLOT_OPTIONS,
  decodeMoves,
  goalFromId,
  type Slots,
} from "@/lib/tools/stone";

export const metadata: Metadata = {
  title: "돌파고 — 어빌리티 스톤 세공",
  description:
    "어빌리티 스톤 세공 결과를 누르면 목표(77돌·97돌 등)까지 가장 확률이 높은 다음 줄과 달성 확률, 새 돌이 몇 개 필요한지 알려 줍니다.",
};

type Params = Promise<Record<string, string | string[] | undefined>>;

function readInitial(params: Record<string, string | string[] | undefined>): StoneInitial {
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value.slice(0, 80) : "";
  };
  const n = Number(one("n"));
  const slots = (SLOT_OPTIONS as readonly number[]).includes(n) ? (n as Slots) : DEFAULT_SLOTS;
  const decText = one("dec");
  const decreaseMax =
    decText === "none"
      ? null
      : DECREASE_OPTIONS.some((o) => o.max !== null && String(o.max) === decText)
        ? Number(decText)
        : DEFAULT_DECREASE;
  const goals = [...new Set(one("goals").split(","))]
    .filter((id) => goalFromId(id))
    .slice(0, MAX_GOALS);
  return {
    slots,
    decreaseMax,
    goals: goals.length ? goals : DEFAULT_GOALS,
    moves: decodeMoves(slots, one("m")),
  };
}

export default async function StonePage({ searchParams }: { searchParams: Params }) {
  return <StoneOptimizer initial={readInitial(await searchParams)} />;
}
