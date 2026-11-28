// 2부 raw-shape guard (api contract draft 2026-11-28, web #1977): when the official armory raw of a character no longer
// has the shape our models read (or a surface's kill switch is on), the api stops computing for it and says so with
// one reason code in the fields that already carry one (reasonCode / stopReasonCode / krakenSortUnavailableReason).
// Off by default on the api. The web maps it first, so 2부 day never shows a generic line that reads as something else
// ('계산식을 확인하고 있어…', '…효율 순으로 보여 드려요' over an empty list). The api's own sentence stays where rows show it.

export const GAME_UPDATE_UNSUPPORTED = "GAME_UPDATE_UNSUPPORTED";

export const isGameUpdate = (code: string | null | undefined) => code === GAME_UPDATE_UNSUPPORTED;

/** The web's lines for this code, per surface (plain 해요체, the api's sentence as the base). */
export const GAME_UPDATE_COPY = {
  simulator: (changed: number) => `바꾼 ${changed}개 항목은 게임 업데이트로 바뀐 장비 정보라 아직 계산하지 않아요.`,
  specUp: "게임 업데이트로 바뀐 장비 정보라 아직 스펙업 후보를 계산하지 않아요.",
  /** The sort bar's short note (the sentence above is read out with it). */
  specUpNote: "업데이트로 아직 계산 안 함",
  gemRanking: "게임 업데이트로 바뀐 장비 정보라 아직 젬 가공 순위를 계산하지 않아요.",
  /** 치명 · 신속 (crit-speed 422, api #1127): no numbers at all, so the whole result says it. */
  critSpeed: {
    title: "아직 계산하지 않아요",
    text: "게임 업데이트로 바뀐 장비 정보라 아직 치명 · 신속을 계산하지 않아요. 업데이트 내용을 반영하면 다시 계산할 수 있어요.",
  },
  /** 원정대 영수증, one member (status UNAVAILABLE + unavailableReasonCode): the row's short word, then its sentence. */
  receiptRow: "업데이트로 계산 안 함",
  receiptRowText: "게임 업데이트로 바뀐 장비 정보라 아직 이 캐릭터의 재련 비용을 계산하지 않아요.",
  /** Every member held (CP_KILL_RECEIPT, or every raw failing): said once at the total, never '0 G'. */
  receiptRoster: "게임 업데이트로 바뀐 장비 정보라 아직 원정대 재련 비용을 계산하지 않아요.",
  /** The coverage line's count for held members, apart from the ones not found. */
  receiptCount: (n: number) => `업데이트로 계산 안 함 ${n}명`,
} as const;
