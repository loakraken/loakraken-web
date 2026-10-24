// Backend side of card-collection.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// card-collection.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/card-collection.openapi.json";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type CardCollectionEnvelope, type CardRefreshEnvelope } from "./card-collection";

// The backend's generated OpenAPI (#102) is also the runtime shape contract,
// with response enums loosened (#125): an unknown element shows as unknown.
const validate = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<CardCollectionEnvelope>({
  $ref: "#/components/schemas/ApiResponseCardCollectionResponse",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
}));

const isTime = (value: string) => Number.isFinite(Date.parse(value));

export function isCardCollectionEnvelope(value: unknown): value is CardCollectionEnvelope {
  if (!validate(value) || value.code !== "CHARACTER_CARD_COLLECTION_SUCCESS") return false;
  const d = value.data;
  return (
    [...d.elementRecords.dealer, ...d.elementRecords.supporter].every(
      (slot) => !slot.record || isTime(slot.record.observedAt),
    ) &&
    d.cards.every((card) => isTime(card.observedAt)) &&
    d.sets.every((set) => isTime(set.observedAt))
  );
}

const validateRefresh = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<CardRefreshEnvelope>({
  $ref: "#/components/schemas/ApiResponseCardCollectionRefreshResponse",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
}));

export function isCardRefreshEnvelope(value: unknown): value is CardRefreshEnvelope {
  return (
    validateRefresh(value) &&
    value.code === "CHARACTER_CARD_COLLECTION_REFRESH_SUCCESS" &&
    isTime(value.data.nextAvailableAt)
  );
}
