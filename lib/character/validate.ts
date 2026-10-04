import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/character.openapi.json";
import type { CharacterEnvelope } from "./model";

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
