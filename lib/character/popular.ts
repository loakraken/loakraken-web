// Popular characters (F-10): most searched on LOAKraken in the last 24 hours
// or 7 days ("인기 검색 캐릭터"). View counts are never shown.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/popular.openapi.json";
import type { components } from "../api/popular-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type PopularEnvelope = Schemas["ApiResponseCharacterPopularResponse"];
export type Popular = Schemas["CharacterPopularResponse"];
export type PopularPeriod = Popular["period"];
export const POPULAR_PERIODS: readonly PopularPeriod[] = ["24h", "7d"];

const validate = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<PopularEnvelope>({
  $ref: "#/components/schemas/ApiResponseCharacterPopularResponse",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
}));

export function isPopularEnvelope(value: unknown): value is PopularEnvelope {
  return (
    validate(value) &&
    value.code === "CHARACTER_POPULAR_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.aggregatedAt))
  );
}

export const isPopularPeriod = (value: unknown): value is PopularPeriod =>
  (POPULAR_PERIODS as readonly unknown[]).includes(value);

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  503: ["CHARACTER_POPULAR_DISABLED", "CHARACTER_POPULAR_UNAVAILABLE"],
};
const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestPopular(
  period: string,
  limit: number,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<PopularEnvelope>> {
  if (!isPopularPeriod(period) || !Number.isInteger(limit) || limit < 1 || limit > 50)
    return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/popular");
  url?.searchParams.set("period", period);
  url?.searchParams.set("limit", String(limit));
  return requestBackend(url, { ...options, isValid: isPopularEnvelope, errorCodes });
}
