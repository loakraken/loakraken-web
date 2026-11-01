// Backend side of title-equip.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// title-equip.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/title-equip.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { titleEquipSearch, type TitleEquipEnvelope, type TitleEquipQuery } from "./title-equip";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<TitleEquipEnvelope>({
    $ref: "#/components/schemas/ApiResponseTitleEquipResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isTitleEquipEnvelope = (value: unknown): value is TitleEquipEnvelope =>
  validate(value) && value.code === "TITLE_EQUIP_SUCCESS";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestTitleEquip(
  query: TitleEquipQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<TitleEquipEnvelope>> {
  const url = backendUrl(origin, "/api/v1/titles/equipped");
  if (url) for (const [key, value] of titleEquipSearch(query)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isTitleEquipEnvelope, errorCodes });
}
