# 디자인 원본 자료 (볼트 사본, 2026-10-12)

사용자가 받아 둔 원본을 그대로 옮겼다. 원본은 볼트 `60 디자인 시스템/방향 전환/`에 있다. 클라우드 세션도 쓸 수 있게 둔다.

- `bencho-code/`: bencho.dev 부품 원본 프롬프트·코드(MIT, bencho.dev/licence)
  - 이미 이식한 것: Checklist, Inline confirm, Reorder list, Assignees. 위치는 `components/ui/bencho/` 등이다.
  - 아직 이식하지 않은 것: Command bar, Like, Liquid toggle, Notify, Pull to refresh.
- `21st.dev/`: Data Refresh State, Streaming Data Rows 원본(MIT, Motiq). 이식을 마쳤다(#549, #567).
- `iconsax-svg/`: 사용자가 받은 Iconsax 무료판 SVG 58개.
  - 화면에서는 이 파일을 직접 쓰지 않는다. `components/ui/icons.tsx`에 등록된 아이콘을 쓴다.
  - 아직 등록되지 않은 아이콘이 필요하면 여기 SVG를 `icons.tsx` 형식으로 옮긴다. 이 작업은 디자인 시스템 소유이니 PR에 요청한다.
  - 여기에도 없는 아이콘은 Iconsax **무료판만** 쓴다. 사용자가 직접 받아야 하므로 PR 본문 '요청'에 아이콘 이름을 적는다.
- `Iconsax 받을 링크.md`: 아이콘별 받는 링크 목록.

**이식 규칙**
- 새 의존성(framer-motion, lucide-react, recharts 등)은 설치하지 않는다. 대신 `motion/react`와 Iconsax를 쓴다.
- CSS 토큰은 우리 토큰에 매핑한다.
- `components/ui/bencho/NOTICE`에 출처를 적는다.
- 공통 부품으로 쓰는 것은 디자인 시스템팀이 이식한다.
