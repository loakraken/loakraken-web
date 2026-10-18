// "남은 시간" for an auction listing, from the minute clock.

const MINUTE = 60_000;

/** "3시간 12분 남음", "1분 안에 끝나요", or "판매 시간이 끝났어요" once past. */
export function timeLeftText(endIso: string, now: number) {
  const minutes = Math.floor((Date.parse(endIso) - now) / MINUTE);
  if (minutes < 0) return "판매 시간이 끝났어요";
  if (minutes < 1) return "1분 안에 끝나요";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return [days && `${days}일`, hours && `${hours}시간`, rest && `${rest}분`].filter(Boolean).join(" ") + " 남음";
}
