// 분석 menu (character screen checklist §14.1 ③): the tools that already take
// this character, in one list beside the tabs. A tool that is off on this
// deployment (server flag) is left out, not shown greyed.

export type AnalysisLink = {
  id: string;
  label: string;
  description: string;
  href: string;
  /** A tab of this page: replace the history entry like the tab links do. */
  tab?: boolean;
};

export type AnalysisFlags = { specUp: boolean; simulator: boolean; critSpeed: boolean };

export function analysisLinks(name: string, server: string | null | undefined, flags: AnalysisFlags): AnalysisLink[] {
  const character = new URLSearchParams({ character: name }).toString();
  const links: (AnalysisLink | false)[] = [
    flags.specUp && {
      id: "specup",
      label: "스펙업 계산",
      description: "골드 대비 전투력이 많이 오르는 순서",
      href: "?tab=specup",
      tab: true,
    },
    flags.simulator && {
      id: "simulator",
      label: "전투력 시뮬레이터",
      description: "무엇을 바꾸면 전투력이 얼마나 오르는지",
      href: "?tab=simulator",
      tab: true,
    },
    flags.critSpeed && {
      id: "crit-speed",
      label: "치적·뭉가·음돌",
      description: "치명·신속 목표까지 필요한 스탯",
      href: `/tools/crit-speed?${character}`,
    },
    {
      id: "compare",
      label: "캐릭터 비교",
      description: "다른 캐릭터와 나란히",
      href: `/multi-search?${new URLSearchParams({ names: name })}`,
    },
    {
      id: "class-stats",
      label: "직업 통계",
      description: server ? `${server} 서버 직업 분포와 평균` : "직업 분포와 평균",
      href: server ? `/stats?${new URLSearchParams({ tab: "classes", server })}` : "/stats?tab=classes",
    },
  ];
  return links.filter((link): link is AnalysisLink => link !== false);
}
