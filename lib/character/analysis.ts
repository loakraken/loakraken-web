// 분석 menu (character screen checklist §14.1 ③): the tools that already take
// this character, in one list beside the tabs. A tool that is off on this
// deployment (server flag) is left out, not shown greyed.
import { classBuildsPath, isClassName } from "@/lib/stats/class-builds";
import { buildComparePath } from "@/lib/stats/build-compare";

export type AnalysisLink = {
  id: string;
  label: string;
  description: string;
  href: string;
  /** A tab of this page: replace the history entry like the tab links do. */
  tab?: boolean;
};

export type AnalysisFlags = { specUp: boolean; simulator: boolean; critSpeed: boolean };
/** The character's class and class engraving, for the class page (M12). */
export type AnalysisClass = { className?: string | null; classEngraving?: string | null };

export function analysisLinks(
  name: string,
  server: string | null | undefined,
  flags: AnalysisFlags,
  cls: AnalysisClass = {},
): AnalysisLink[] {
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
    // The class page in comparison mode (M26 stage 1): this character's
    // setting next to the most chosen ones of its class and class engraving.
    cls.className && isClassName(cls.className)
      ? {
          id: "build-compare",
          label: "대세 빌드 비교",
          description: `${cls.className}${cls.classEngraving ? ` ${cls.classEngraving}` : ""} 대세 세팅과 내 세팅`,
          href: buildComparePath(cls.className, cls.classEngraving, name),
        }
      : false,
    // The class page (M12) with this character's class engraving; without a
    // class (an old record), the class table of the stats screen.
    cls.className && isClassName(cls.className)
      ? {
          id: "class-stats",
          label: "직업 통계",
          description: `${cls.className}${cls.classEngraving ? ` ${cls.classEngraving}` : ""} 인기 세팅 통계`,
          href: classBuildsPath(cls.className, { classEngraving: cls.classEngraving ?? undefined }),
        }
      : {
          id: "class-stats",
          label: "직업 통계",
          description: server ? `${server} 서버 직업 분포와 평균` : "직업 분포와 평균",
          href: server ? `/stats?${new URLSearchParams({ tab: "classes", server })}` : "/stats?tab=classes",
        },
  ];
  return links.filter((link): link is AnalysisLink => link !== false);
}
