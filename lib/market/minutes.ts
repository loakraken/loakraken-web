// Minute prices (backend #484, checklist K35): the prices the market warm-up
// already fetched, gathered into UTC minutes over the last 1~120 minutes. No
// extra official call. Only the minutes it saw have a point; how often an item
// is fetched differs (sampleEverySeconds: about 30s for the board's default
// tab, 10 minutes for refining materials, 30 for engraving books), and an item
// it does not warm up has no points.

import type { components } from "../api/market-minutes-schema";

type Schemas = components["schemas"];
export type MinuteChartEnvelope = Schemas["ApiResponseMarketMinuteChartResponse"];
export type MinuteChart = Schemas["MarketMinuteChartResponse"];
export type MinutePoint = Schemas["MarketMinutePointResponse"];

/** The last hour: the window the screen shows. */
export const MINUTE_WINDOW = 60;

/** An official market item id, as the backend allows (1 ~ 999,999,999). */
export const parseMinuteItemId = (value: string) => {
  if (!/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
};

/**
 * "약 30초마다 확인", "약 10분마다 확인": how often the item is fetched, so a
 * sparse line reads as what it is. Null when nothing was seen yet.
 */
export function sampleText(seconds: number | null | undefined) {
  if (seconds == null || seconds <= 0) return null;
  if (seconds < 60) return `약 ${seconds}초마다 확인`;
  return `약 ${Math.round(seconds / 60).toLocaleString("ko-KR")}분마다 확인`;
}

const hourMinute = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "14:05" in Korea time. */
export const minuteLabel = (iso: string) => hourMinute.format(new Date(iso));
