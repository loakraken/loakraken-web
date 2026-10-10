// Every tool screen, for the /tools list (and the moved /tools/stone address).
export type ToolEntry = {
  href: string;
  label: string;
  description: string;
  group: "계산기" | "레이드·숙제";
  /** Hidden where its runtime flag is off (see lib/tools/flags.ts). */
  flag?: "critSpeed";
};

export const TOOLS: ToolEntry[] = [
  { href: "/tools/refining", label: "재련 기대 비용", description: "목표 단계까지 확률과 골드, 구매 골드·소모 가치", group: "계산기" },
  { href: "/tools/material-quote", label: "재료 구매 견적", description: "필요한 재료와 보유 수량으로 추가 구매 골드", group: "계산기" },
  { href: "/tools/crit-speed", label: "치적·뭉가·음돌", description: "치명·신속 목표까지 필요한 스탯", group: "계산기", flag: "critSpeed" },
  { href: "/tools/auction", label: "경매 입찰가", description: "파티 인원별 손익 분기와 선점가", group: "계산기" },
  { href: "/tools/more-reward", label: "더보기 손익", description: "관문마다 더보기가 남는지 지금 시세로", group: "레이드·숙제" },
  { href: "/tools/raid-rewards", label: "레이드 보상표", description: "관문별 골드·귀속 골드·더보기 비용", group: "레이드·숙제" },
  { href: "/tools/homework", label: "숙제 체크", description: "원정대 주간 레이드와 골드", group: "레이드·숙제" },
];

export function visibleTools(flags: { critSpeed: boolean }) {
  return TOOLS.filter((tool) => !tool.flag || flags[tool.flag]);
}
