// 카오스게이트 클리어 골드 (사용자 피드백 10-26 #1, 11-02: 대표 보상에 골드).
//
// 공식: 공지 13307(2025-12-10)에서 카오스게이트 클리어 보상에 캐릭터 귀속 골드가
// 생겼고 높은 구간일수록 많다고 했지만, 구간별 수량은 공개하지 않았다(공지
// 13339·13395, 가이드 2026-08-05 수정본에도 없음). 그래서 골드가 있다는 것은
// 1580 이상 모든 구간에 보이고, 수량은 아래 표에 있는 구간만 보인다.
// 수량: 1720~1729 구간만 서로 다른 작성자의 커뮤니티 글 세 개가 같은 값(3,000골드)을
// 말한다. 다른 구간은 근거가 하나 이하라 숫자를 보이지 않는다(출처 규칙: 공식이
// 아니면 두 곳이 같아야 함). 공식 수량이 나오면 이 파일만 고친다.

/** Gold is part of every chaos gate clear from this entry level on (official notice). */
export const CHAOS_GATE_GOLD_FROM = 1580;

/** Bands with an agreed amount, each with its sources. */
export const CHAOS_GATE_GOLD = [
  {
    from: 1720,
    to: 1729,
    gold: 3000,
    asOf: "2025-12",
    source: [
      "https://lostark.game.onstove.com/News/Notice/Views/13307 (확인 2026-11-02, 골드 있음·수량 없음)",
      "https://www.inven.co.kr/board/lostark/4821/108848 (2025-12-11, 확인 2026-11-02)",
      "https://www.inven.co.kr/board/lostark/6271/3018840 (2025-12-11, 확인 2026-11-02)",
      "https://www.inven.co.kr/board/lostark/6271/3154141 (2026-01-11, 확인 2026-11-02)",
    ],
  },
] as const;

/**
 * The clear gold for entry levels from `level` up to (not including) `next`:
 * the amount when that whole range sits inside one agreed band, else null
 * (gold still drops, its amount is not known). A group whose range spans two
 * bands never takes either amount.
 */
export function chaosGateGold(level: number | null | undefined, next: number | null | undefined): number | null {
  if (level == null) return null;
  const last = next != null && next > level ? next - 1 : Infinity;
  return CHAOS_GATE_GOLD.find((band) => level >= band.from && last <= band.to)?.gold ?? null;
}

/** The reward line's text: "골드 3,000" when the amount is known, else "골드". */
export const chaosGateGoldLabel = (gold: number | null) =>
  gold == null ? "골드" : `골드 ${gold.toLocaleString("ko-KR")}`;
