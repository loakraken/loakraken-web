// Backend side of item-tooltips.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// item-tooltips.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/item-tooltips.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type ItemTooltipsEnvelope } from "./item-tooltips";

// A backend before #286 has no extraLineSections (the lines then stay at the
// end); one before #289 has no ark grid lines (the cards keep the search data).
const ROLLOUT: Record<string, string[]> = {
  EquipmentLinesResponse: ["extraLineSections"],
  CharacterItemTooltipsResponse: ["arkGrid"],
  // Before #300/#310: no official skill lines or tripod options.
  SkillLinesResponse: ["titleLines", "infoLines", "tripodOptions"],
};

const validate = lazyValidator(() => {
  const schemas = tolerantSchemas(contract.components.schemas) as Record<string, { required?: string[] }>;
  for (const [name, fields] of Object.entries(ROLLOUT))
    schemas[name] = { ...schemas[name], required: schemas[name].required?.filter((field) => !fields.includes(field)) };
  return new Ajv2020({ strict: false, validateFormats: false }).compile<ItemTooltipsEnvelope>({
    $ref: "#/components/schemas/ApiResponseCharacterItemTooltipsResponse",
    components: { ...contract.components, schemas },
  });
});

export function isItemTooltipsEnvelope(value: unknown): value is ItemTooltipsEnvelope {
  return validate(value) && value.code === "CHARACTER_ITEM_TOOLTIPS_SUCCESS";
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND", "CHARACTER_NOT_CACHED"],
  429: ["LOST_ARK_RATE_LIMITED"],
  503: ["CHARACTER_CACHE_UNAVAILABLE"],
};

const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestItemTooltips(
  name: string,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<ItemTooltipsEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/item-tooltips");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isItemTooltipsEnvelope, errorCodes });
}
