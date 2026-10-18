// Roster reads (원정대 전투력, 카드 기록 채우기) stop early when the official
// calls run short and say how many are left (remaining). The line tells how
// many and when the button opens again, in whole minutes counted once from
// the answer, so it never ticks inside a live region (PM-프론트 10-18 (d)).

/** Whole minutes from the press until the button opens again, at least 1. */
export function minutesUntil(availableAt: string | null | undefined, from: number) {
  const at = availableAt ? Date.parse(availableAt) : NaN;
  return Number.isFinite(at) ? Math.max(1, Math.ceil((at - from) / 60_000)) : 1;
}

/**
 * 'N명 남음 · M분 뒤 이어서 …' when some are left; when none came this time,
 * '지금은 불러오지 못했어요 · M분 뒤 다시 눌러 주세요'. Null when all were read.
 */
export function continueText(remaining: number, read: number, minutes: number, verb = "불러올") {
  if (remaining <= 0) return null;
  if (read <= 0) return `지금은 불러오지 못했어요 · ${minutes}분 뒤 다시 눌러 주세요`;
  return `${remaining}명 남음 · ${minutes}분 뒤 이어서 ${verb} 수 있어요`;
}
