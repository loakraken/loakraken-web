// Backend side of minutes.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// minutes.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/market-minutes.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { MINUTE_WINDOW, type MinuteChartEnvelope } from "./minutes";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<MinuteChartEnvelope>({
    $ref: "#/components/schemas/ApiResponseMarketMinuteChartResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isMinuteChartEnvelope = (value: unknown): value is MinuteChartEnvelope =>
  validate(value) && value.code === "MARKET_ITEM_MINUTES_SUCCESS";

export function requestItemMinutes(
  itemId: number,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<MinuteChartEnvelope>> {
  const url = backendUrl(origin, `/api/v1/markets/items/${itemId}/minutes`);
  url?.searchParams.set("minutes", String(MINUTE_WINDOW));
  return requestBackend(url, { ...options, isValid: isMinuteChartEnvelope, errorCodes: { 400: ["INVALID_REQUEST"] } });
}
