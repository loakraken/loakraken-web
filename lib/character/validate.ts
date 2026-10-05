import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/character.openapi.json";
import type { CharacterEnvelope } from "./model";
import siblingsContract from "../../contracts/siblings.openapi.json";
import historyContract from "../../contracts/history.openapi.json";
import type { components as SiblingsSchemas } from "../api/siblings-schema";
import type { components as HistorySchemas } from "../api/history-schema";

// The backend's generated OpenAPI is also the runtime shape contract.
const ajv = new Ajv2020({ strict: false, validateFormats: false });
const components = structuredClone(contract.components);
// A newly added rule must not hide an otherwise valid character response.
// Keep categories, evidence shape, and every other generated constraint strict.
Reflect.deleteProperty(
  components.schemas.DiagnosticFindingResponse.properties.code,
  "enum",
);
const validate = ajv.compile<CharacterEnvelope>({
  $ref: "#/components/schemas/ApiResponseCharacterResponse",
  components,
});

export function isCharacterEnvelope(
  value: unknown,
): value is CharacterEnvelope {
  return (
    validate(value) &&
    value.code === "CHARACTER_SEARCH_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.fetchedAt))
  );
}

// Siblings (#54) and observation history (#66) use their own captured contracts.

export type SiblingsEnvelope =
  SiblingsSchemas["schemas"]["ApiResponseCharacterSiblingsResponse"];
export type HistoryEnvelope =
  HistorySchemas["schemas"]["ApiResponseCharacterHistoryResponse"];
export type HistoryPoint = HistorySchemas["schemas"]["PointResponse"];

const compileWith = <T>(source: { components: object }, schema: string) =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
    $ref: `#/components/schemas/${schema}`,
    components: source.components,
  });
const siblings = compileWith<SiblingsEnvelope>(
  siblingsContract,
  "ApiResponseCharacterSiblingsResponse",
);
const history = compileWith<HistoryEnvelope>(
  historyContract,
  "ApiResponseCharacterHistoryResponse",
);
const isTime = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

export function isSiblingsEnvelope(value: unknown): value is SiblingsEnvelope {
  return (
    siblings(value) &&
    value.code === "CHARACTER_SIBLINGS_SUCCESS" &&
    isTime(value.data.fetchedAt)
  );
}

export function isHistoryEnvelope(value: unknown): value is HistoryEnvelope {
  return (
    history(value) &&
    value.code === "CHARACTER_HISTORY_SUCCESS" &&
    value.data.points.every(
      (point) => isTime(point.observedAt) && isTime(point.lastConfirmedAt),
    )
  );
}
