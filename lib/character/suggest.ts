// Character name autocomplete (backend #372) for the header search panel:
// up to 8 characters whose name starts with what was typed, from the
// characters LOAKraken has seen. Short input gives an empty list; characters
// on the processing-stop list never appear (backend side).
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/suggest.openapi.json";
import type { components } from "../api/suggest-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type SuggestEnvelope = Schemas["ApiResponseCharacterSuggestResponse"];
export type SuggestItem = Schemas["CharacterSuggestItemResponse"];

/** The same limit as a character name; longer input cannot match. */
export const SUGGEST_MAX = 16;

// Backend #372's OpenAPI marks no item field required or nullable (its
// ResponseContracts step was not applied; asked 10-12), yet characterImage is
// null until a profile is recorded, as its own description says. Until the
// published contract says so, null is allowed for that one field here.
const schemas = structuredClone(tolerantSchemas(contract.components.schemas)) as Record<string, { properties?: Record<string, unknown> }>;
const item = schemas.CharacterSuggestItemResponse?.properties;
if (item) item.characterImage = { type: ["string", "null"] };

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<SuggestEnvelope>({
    $ref: "#/components/schemas/ApiResponseCharacterSuggestResponse",
    components: { ...contract.components, schemas },
  }),
);
export const isSuggestEnvelope = (value: unknown): value is SuggestEnvelope =>
  validate(value) && value.code === "CHARACTER_SUGGEST_SUCCESS";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  503: ["CHARACTER_STORAGE_UNAVAILABLE"],
};
const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestSuggest(
  q: string,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<SuggestEnvelope>> {
  const text = q.trim();
  if (!text || [...text].length > SUGGEST_MAX) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/suggest");
  url?.searchParams.set("q", text);
  return requestBackend(url, { ...options, isValid: isSuggestEnvelope, errorCodes });
}
