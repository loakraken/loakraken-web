// Site-wide menu: every feature LOAKraken absorbs from the other Lost Ark
// sites, grouped the way those sites group them. Items without `href` are
// planned and render as "준비 중" (not links).
export type NavLink = {
  label: string;
  description: string;
  href?: string;
};
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
          { label: "서비스 소개", description: "흩어진 정보를 한 곳에서", href: "/#intro" },
          { label: "캐릭터 미리보기", description: "예시 데이터로 보는 화면", href: "/#preview" },
          { label: "근거 보기", description: "결과마다 원본 데이터를 함께", href: "/#evidence" },
          { label: "로드맵", description: "흡수 중인 기능과 순서", href: "/#roadmap" },
        ],
      },
    ],
  },
  {
    id: "character",
    label: "캐릭터",
    match: ["/character"],
    groups: [
      {
        title: "조회",
        links: [
          { label: "캐릭터 검색", description: "장비·스킬·아크 패시브·내실", href: "/#intro" },
          { label: "군장검사", description: "여러 캐릭터를 한 번에 비교" },
          { label: "길드", description: "길드원 세팅 한눈에" },
        ],
      },
      {
        title: "순위",
        links: [{ label: "랭킹", description: "전투력·아이템 레벨 순위와 백분위" }],
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
        links: [{ label: "보석·장신구 시세", description: "경매장 매물 검색과 시세" }],
      },
    ],
  },
  {
    id: "tools",
    label: "성장 도구",
    match: ["/tools/refining", "/tools/crit-speed"],
    groups: [
      {
        title: "계산기",
        links: [
          { label: "재련 기대 비용", description: "목표 단계까지 확률과 골드", href: "/tools/refining" },
          { label: "치적·뭉가·음돌", description: "치명·신속 목표까지 필요한 스탯", href: "/tools/crit-speed" },
          { label: "경매 입찰가", description: "파티 인원별 손익 분기" },
          { label: "더보기 손익", description: "레이드 더보기 보상 효율" },
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
    match: ["/schedule"],
    groups: [
      {
        title: "오늘",
        links: [
          { label: "오늘의 일정", description: "모험 섬 보상·필드 보스·카오스 게이트" },
          { label: "공지·이벤트", description: "점검과 진행 중인 이벤트" },
        ],
      },
      {
        title: "내 진행",
        links: [{ label: "숙제 체크", description: "원정대 일일·주간 숙제" }],
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
          { label: "직업·전투력 분포", description: "레벨 구간별 직업 비율과 분위" },
          { label: "채택률", description: "각인·아크 패시브·코어 선택" },
        ],
      },
    ],
  },
];

export function sectionOf(pathname: string) {
  return (
    NAV_SECTIONS.find((section) =>
      section.match?.some((prefix) => pathname.startsWith(prefix)),
    )?.id ?? null
  );
}
