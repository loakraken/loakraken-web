// 오픈 소스·출처 (/credits): what the site is built with and whose work it
// adapts, with each licence and a link. Keep in step with package.json
// (runtime dependencies), app/fonts, NOTICE, components/ui/NOTICE-motiq and
// components/ui/bencho/NOTICE; a unit test checks the dependency list.

export type Credit = {
  name: string;
  /** What it is used for here, in a few words. */
  use: string;
  licence: string;
  /** The project's own page (https). */
  href: string;
  /** Who holds the copyright, when the licence asks for the notice. */
  holder?: string;
  /**
   * For parts copied from a component marketplace: the original component
   * page, linked visibly (21st.dev terms §3, checked 2026-10-25).
   */
  source?: { label: string; href: string };
};

/** Interface parts adapted into the site's own code. */
export const ADAPTED: readonly Credit[] = [
  {
    name: "Motiq — Data Refresh State",
    use: "새로 불러오는 동안의 표시",
    licence: "MIT",
    holder: "© 2026 Mahammad Rustamov",
    href: "https://motiq.dev",
    source: { label: "21st.dev 원본: Data Refresh State", href: "https://21st.dev/@rmahammad/components/data-refresh-state" },
  },
  {
    name: "Motiq — Streaming Data Rows",
    use: "값이 바뀐 칸 표시",
    licence: "MIT",
    holder: "© 2026 Mahammad Rustamov",
    href: "https://motiq.dev",
    source: { label: "21st.dev 원본: Streaming Data Rows", href: "https://21st.dev/@rmahammad/components/streaming-data-rows" },
  },
  {
    name: "Bencho blocks",
    use: "일부 화면 블록(결과 패널 등)",
    licence: "MIT",
    holder: "© 2026 Lorenzo Cabra",
    href: "https://bencho.dev",
  },
  {
    name: "shadcn/ui",
    use: "기본 색·테두리 이름(CSS 변수)",
    licence: "MIT",
    holder: "© 2023 shadcn",
    href: "https://ui.shadcn.com",
  },
];

/** Icons and type. */
export const ASSETS: readonly Credit[] = [
  {
    name: "Iconsax",
    use: "화면 아이콘",
    licence: "Iconsax 무료 라이선스",
    holder: "© Iconsax",
    href: "https://iconsax.io",
  },
  {
    name: "Phosphor Icons",
    use: "디스코드 로고",
    licence: "MIT",
    holder: "© 2023 Phosphor Icons",
    href: "https://phosphoricons.com",
  },
  {
    name: "Pretendard",
    use: "본문 글꼴",
    licence: "SIL Open Font License 1.1",
    holder: "© 2021 Kil Hyung-jin",
    href: "https://github.com/orioncactus/pretendard",
  },
  {
    name: "Geist Mono",
    use: "숫자·코드 글꼴",
    licence: "SIL Open Font License 1.1",
    holder: "© 2023 Vercel",
    href: "https://vercel.com/font",
  },
];

/** Libraries the pages run on (package.json dependencies). */
export const LIBRARIES: readonly Credit[] = [
  { name: "Next.js", use: "웹 프레임워크", licence: "MIT", href: "https://nextjs.org" },
  { name: "React", use: "화면 구성", licence: "MIT", href: "https://react.dev" },
  { name: "Base UI", use: "선택 상자·팝오버 등 부품", licence: "MIT", href: "https://base-ui.com" },
  { name: "TanStack Query", use: "데이터 불러오기·캐시", licence: "MIT", href: "https://tanstack.com/query" },
  { name: "Motion", use: "움직임", licence: "MIT", href: "https://motion.dev" },
  { name: "React Hook Form", use: "입력 양식", licence: "MIT", href: "https://react-hook-form.com" },
  { name: "Zod", use: "입력 검사", licence: "MIT", href: "https://zod.dev" },
  { name: "Ajv", use: "응답 형식 검사", licence: "MIT", href: "https://ajv.js.org" },
  { name: "Zustand", use: "화면 상태", licence: "MIT", href: "https://zustand.docs.pmnd.rs" },
  { name: "class-variance-authority", use: "스타일 변형", licence: "Apache-2.0", href: "https://cva.style" },
  { name: "tw-animate-css", use: "애니메이션 유틸리티", licence: "MIT", href: "https://github.com/Wombosvideo/tw-animate-css" },
  { name: "Libraries.dev (border-beam, liquid-gooey, thinking-orbs)", use: "빛 테두리·불러오는 표시", licence: "MIT", href: "https://libraries.dev" },
  { name: "cn", use: "스타일 이름 합치기", licence: "MIT", href: "https://github.com/shadcn-ui/cn" },
  { name: "server-only", use: "서버 전용 코드 표시", licence: "MIT", href: "https://www.npmjs.com/package/server-only" },
];

/** package.json runtime dependencies each entry above stands for (checked by a unit test). */
export const DEPENDENCY_CREDITS: Record<string, string> = {
  next: "Next.js",
  react: "React",
  "react-dom": "React",
  "@base-ui/react": "Base UI",
  "@tanstack/react-query": "TanStack Query",
  motion: "Motion",
  "react-hook-form": "React Hook Form",
  "@hookform/resolvers": "React Hook Form",
  zod: "Zod",
  ajv: "Ajv",
  zustand: "Zustand",
  "class-variance-authority": "class-variance-authority",
  "tw-animate-css": "tw-animate-css",
  "border-beam": "Libraries.dev (border-beam, liquid-gooey, thinking-orbs)",
  "liquid-gooey": "Libraries.dev (border-beam, liquid-gooey, thinking-orbs)",
  "thinking-orbs": "Libraries.dev (border-beam, liquid-gooey, thinking-orbs)",
  cn: "cn",
  "server-only": "server-only",
};
