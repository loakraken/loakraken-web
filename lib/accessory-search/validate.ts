import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/accessory-search.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { SearchEnvelope } from "./model";

// The backend's OpenAPI (backend #431) is the runtime shape contract, made
// tolerant of additive changes (a new polish level reads as unknown).
const search = lazyValidator<SearchEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({
    $id: "accessory-search",
    components: { schemas: tolerantSchemas(contract.components.schemas) },
  });
  return ajv.compile<SearchEnvelope>({ $ref: "accessory-search#/components/schemas/ApiResponseAccessorySearchResponse" });
});

export function isSearchEnvelope(value: unknown): value is SearchEnvelope {
  return search(value) && value.code === "AUCTION_SEARCH_SUCCESS" && Number.isFinite(Date.parse(value.data.observedAt));
}
