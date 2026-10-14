// Minute prices (backend #484, checklist K35): the prices the market warm-up
// already fetched, gathered into UTC minutes over the last 1~120 minutes. No
// extra official call. Only the minutes it saw have a point; how often an item
// is fetched differs (sampleEverySeconds: about 30s for the board's default
// tab, 10 minutes for refining materials, 30 for engraving books), and an item
// it does not warm up has no points.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/market-minutes.openapi.json";
import type { components } from "../api/market-minutes-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type MinuteChartEnvelope = Schemas["ApiResponseMarketMinuteChartResponse"];
export type MinuteChart = Schemas["MarketMinuteChartResponse"];
export type MinutePoint = Schemas["MarketMinutePointResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<MinuteChartEnvelope>({
    $ref: "#/components/schemas/ApiResponseMarketMinuteChartResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isMinuteChartEnvelope = (value: unknown): value is MinuteChartEnvelope =>
  validate(value) && value.code === "MARKET_ITEM_MINUTES_SUCCESS";

/** The last hour: the window the screen shows. */
export const MINUTE_WINDOW = 60;

/** An official market item id, as the backend allows (1 ~ 999,999,999). */
export const parseMinuteItemId = (value: string) => {
  if (!/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
};

export function requestItemMinutes(
  itemId: number,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<MinuteChartEnvelope>> {
  const url = backendUrl(origin, `/api/v1/markets/items/${itemId}/minutes`);
  url?.searchParams.set("minutes", String(MINUTE_WINDOW));
  return requestBackend(url, { ...options, isValid: isMinuteChartEnvelope, errorCodes: { 400: ["INVALID_REQUEST"] } });
}

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
