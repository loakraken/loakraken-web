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
  specUpNote: "게임 업데이트로 계산 멈춤",
  gemRanking: "게임 업데이트로 바뀐 장비 정보라 아직 젬 가공 순위를 계산하지 않아요.",
} as const;
