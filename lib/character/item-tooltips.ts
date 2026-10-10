// The rest of each official item tooltip (backend #227): durability, "분해불가",
// descriptions, where to get it — lines the search response leaves out. Read
// from the backend's character cache only (no official call); keyed to the
// search response by equipment index + type, gem/card slot and skill name.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/item-tooltips.openapi.json";
import type { components } from "../api/item-tooltips-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type ItemTooltipsEnvelope = Schemas["ApiResponseCharacterItemTooltipsResponse"];
export type ItemTooltips = Schemas["CharacterItemTooltipsResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<ItemTooltipsEnvelope>({
    $ref: "#/components/schemas/ApiResponseCharacterItemTooltipsResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

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

/** Extra lines for the equipment at `index` (search order) — only if the type still matches. */
export function equipmentLines(data: ItemTooltips | undefined, index: number, type: string | null) {
  const entry = data?.equipment.find((item) => item.index === index);
  return entry && (type == null || entry.type === type) ? entry.extraLines : [];
}

export type LineTone = "warn" | "craft" | "plain";

/**
 * Colour of an official tooltip line as the game (and the reference site)
 * shows it: "…불가" restrictions red, "[제작] …"-style sources cyan, the rest
 * plain (durability, descriptions).
 */
export function lineTone(line: string): LineTone {
  if (/불가/.test(line)) return "warn";
  if (/^\[[^\]]+\]/.test(line.trim())) return "craft";
  return "plain";
}
