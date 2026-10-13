// Site-wide menu: every feature LOAKraken absorbs from the other Lost Ark
// sites, grouped the way those sites group them. Items without `href` are
// planned and render as "준비 중" (not links).
export type NavLink = {
  label: string;
  description: string;
  href?: string;
  /** Shown only when this runtime flag is on (lib/tools/flags.ts, /api/flags). */
  flag?: NavFlag;
};
export type NavFlag = "critSpeed" | "combatPower" | "accessorySearch";
export type NavFlags = Partial<Record<NavFlag, boolean>>;
export type NavSection = {
  id: string;
  label: string;
  /** Pathname prefixes that mark this section as the current one. */
  match?: string[];
  groups: { title: string; links: NavLink[] }[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "about",
    label: "소개",
    groups: [
      {
        title: "LOAKraken",
        links: [
          { label: "서비스 소개", description: "흩어진 정보를 한 곳에서", href: "/about#intro" },
          { label: "캐릭터 미리보기", description: "예시 데이터로 보는 화면", href: "/about#preview" },
          { label: "근거 보기", description: "결과마다 원본 데이터를 함께", href: "/about#evidence" },
          { label: "로드맵", description: "흡수 중인 기능과 순서", href: "/about#roadmap" },
        ],
      },
    ],
  },
  {
    id: "character",
    label: "캐릭터",
    match: ["/character", "/multi-search", "/rankings"],
    groups: [
      {
        title: "조회",
        links: [
          { label: "캐릭터 검색", description: "장비·스킬·아크 패시브·내실", href: "/" },
          { label: "멀티서치", description: "여러 캐릭터를 나란히 비교", href: "/multi-search" },
          { label: "길드", description: "길드원 세팅 한눈에" },
        ],
      },
      {
        title: "순위",
        links: [{ label: "랭킹", description: "전투력·아이템 레벨 순위와 백분위", href: "/rankings" }],
      },
    ],
  },
  {
    id: "market",
    label: "시세",
    match: ["/market", "/tools/material-quote"],
    groups: [
      {
        title: "거래소",
        links: [
          { label: "거래소 시세", description: "분류별 최저가·등락·14일 추이", href: "/market" },
          { label: "재료 구매 견적", description: "필요한 만큼, 지금 시세로", href: "/tools/material-quote" },
        ],
      },
      {
        title: "경매장",
        links: [
          { label: "보석 시세", description: "겁화·작열 레벨별 최저가와 매물", href: "/market/gems" },
          { label: "장신구 시세", description: "연마 효과 등급 조합별 최저가와 매물", href: "/market/accessories" },
        ],
      },
    ],
  },
  {
    id: "tools",
    label: "성장 도구",
    // "/tools$": the tool list itself (exact; a bare prefix would also take the
    // tools filed under other menus, such as /tools/material-quote).
    match: ["/tools$", "/tools/combat-power", "/tools/refining", "/tools/crit-speed", "/tools/auction", "/tools/raid-rewards", "/tools/more-reward", "/tools/contribution", "/tools/raid-cheatsheet", "/tools/accessory-search"],
    groups: [
      {
        title: "계산기",
        links: [
          { label: "도구 전체", description: "모든 성장 도구를 한눈에", href: "/tools" },
          // 사용자 지적(PM-프론트 21:27): the simulator was missing from the menu.
          { label: "전투력 시뮬레이터", description: "무엇을 바꾸면 전투력이 얼마나 오르는지", href: "/tools/combat-power", flag: "combatPower" },
          { label: "재련 기대 비용", description: "목표 단계까지 확률과 골드", href: "/tools/refining" },
          { label: "치적·뭉가·음돌", description: "치명·신속 목표까지 필요한 스탯", href: "/tools/crit-speed", flag: "critSpeed" },
          { label: "경매 입찰가", description: "파티 인원별 손익 분기와 선점가", href: "/tools/auction" },
          { label: "악세 경매 검색", description: "연마 효과·깨달음·힘민지 범위로 매물 찾기", href: "/tools/accessory-search", flag: "accessorySearch" },
          { label: "레이드 보상표", description: "관문별 골드·더보기 비용", href: "/tools/raid-rewards" },
          { label: "더보기 손익", description: "관문마다 더보기가 남는지 지금 시세로", href: "/tools/more-reward" },
          { label: "기여도 계산기", description: "내 피해량이 관문 기준에서 어디쯤인지", href: "/tools/contribution" },
          { label: "레이드 컨닝페이퍼", description: "관문마다 주요 패턴과 대응", href: "/tools/raid-cheatsheet" },
        ],
      },
      {
        title: "추천",
        links: [
          { label: "스펙업 가이드", description: "1%당 골드로 정렬한 다음 성장" },
          { label: "젬 가공", description: "화면 인식으로 가공 선택 추천" },
        ],
      },
    ],
  },
  {
    id: "schedule",
    label: "일정",
    match: ["/schedule", "/news", "/tools/homework"],
    groups: [
      {
        title: "오늘",
        links: [
          { label: "주간 일정", description: "모험 섬·카오스게이트·필드 보스·섬·항해·로웬", href: "/schedule" },
          { label: "공지·이벤트", description: "공지·패치 이력·진행 중인 이벤트", href: "/news" },
        ],
      },
      {
        title: "내 진행",
        links: [{ label: "숙제 체크", description: "원정대 일일·주간 숙제", href: "/tools/homework" }],
      },
    ],
  },
  {
    id: "stats",
    label: "통계",
    match: ["/stats"],
    groups: [
      {
        title: "분포",
        links: [
          { label: "직업 통계", description: "직업별 인원과 전투력 분위", href: "/stats" },
          { label: "전투력·레벨 분포", description: "내 값은 상위 몇 %인지", href: "/stats?tab=distribution" },
          { label: "서버 통계", description: "서버별 인원과 중앙값", href: "/stats?tab=servers" },
          { label: "채택률", description: "각인·아크 패시브·코어 선택" },
        ],
      },
    ],
  },
];

export function sectionOf(pathname: string) {
  return (
    NAV_SECTIONS.find((section) =>
      section.match?.some((prefix) =>
        prefix.endsWith("$") ? pathname === prefix.slice(0, -1) : pathname.startsWith(prefix),
      ),
    )?.id ?? null
  );
}
