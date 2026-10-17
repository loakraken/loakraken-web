// Every tool screen, for the /tools list (and the moved /tools/stone address).
export type ToolEntry = {
  href: string;
  label: string;
  description: string;
  group: "계산기" | "레이드·숙제";
  /** Hidden where its runtime flag is off (see lib/tools/flags.ts). */
  flag?: "critSpeed" | "combatPower" | "accessorySearch";
};

export const TOOLS: ToolEntry[] = [
  { href: "/tools/combat-power", label: "전투력 시뮬레이터", description: "보석·재련·품질을 바꾸면 전투력이 얼마나 오르는지", group: "계산기", flag: "combatPower" },
  { href: "/tools/accessory-search", label: "악세 경매 검색", description: "연마 효과·깨달음·힘민지 범위로 T4 장신구 매물 찾기", group: "계산기", flag: "accessorySearch" },
  { href: "/tools/refining", label: "재련 기대 비용", description: "목표 단계까지 확률과 골드, 구매 골드·소모 가치", group: "계산기" },
  { href: "/tools/material-quote", label: "재료 구매 견적", description: "필요한 재료와 보유 수량으로 추가 구매 골드", group: "계산기" },
  { href: "/tools/crit-speed", label: "치적·뭉가·음돌", description: "치명·신속 목표까지 필요한 스탯", group: "계산기", flag: "critSpeed" },
  { href: "/tools/auction", label: "경매 입찰가", description: "파티 인원별 손익 분기와 선점가", group: "계산기" },
  { href: "/tools/loa-shop", label: "로아샵 효율", description: "상점 패키지 구성품을 지금 시세로", group: "계산기" },
  { href: "/tools/abidos-craft", label: "아비도스 제작 손익", description: "융화 재료 1회 제작 비용과 손익", group: "계산기" },
  { href: "/tools/life-energy", label: "생명의 기운 효율", description: "생활 스킬마다 생명의 기운으로 버는 골드", group: "계산기" },
  { href: "/tools/more-reward", label: "더보기 손익", description: "관문마다 더보기가 남는지 지금 시세로", group: "레이드·숙제" },
  { href: "/tools/contribution", label: "기여도 계산기", description: "내 피해량이 관문 기준에서 어디쯤인지", group: "레이드·숙제" },
  { href: "/tools/raid-cheatsheet", label: "레이드 컨닝페이퍼", description: "관문마다 주요 패턴과 대응", group: "레이드·숙제" },
  { href: "/tools/raid-rewards", label: "레이드 보상표", description: "관문별 골드·귀속 골드·더보기 비용", group: "레이드·숙제" },
  { href: "/tools/homework", label: "숙제 체크", description: "원정대 주간 레이드와 골드", group: "레이드·숙제" },
];

export function visibleTools(flags: Record<NonNullable<ToolEntry["flag"]>, boolean>) {
  return TOOLS.filter((tool) => !tool.flag || flags[tool.flag]);
}
