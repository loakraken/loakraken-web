// Backend side of receipt.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// receipt.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/receipt.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { type ReceiptEnvelope } from "./receipt";

// Response enums loosened: a new reason or kind shows "알 수 없음", not an error page.
const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<ReceiptEnvelope>({
    $ref: "#/components/schemas/ApiResponseReceiptResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

const isTime = (value: string) => Number.isFinite(Date.parse(value));

export function isReceiptEnvelope(value: unknown): value is ReceiptEnvelope {
  return validate(value) && value.code === "RECEIPT_SUCCESS" && isTime(value.data.computedAt);
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  // Every 429 (CLIENT_RATE_LIMITED included) reads as the shared rate limit.
  429: ["LOST_ARK_RATE_LIMITED"],
  503: ["CHARACTER_CACHE_UNAVAILABLE", "MARKET_CACHE_UNAVAILABLE", "LOST_ARK_GATE_UNAVAILABLE"],
};

const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestReceipt(
  name: string,
  assumeBook: boolean,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<ReceiptEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/receipt");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  // Always explicit (PM 총괄 10-11): if the backend default changes, "책 제외" still holds.
  url?.searchParams.set("assumeBook", String(assumeBook));
  return requestBackend(url, { ...options, isValid: isReceiptEnvelope, errorCodes });
}
