import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/crit-speed.openapi.json";
import { tolerantSchemas } from "../tools/contract";
import type { CritSpeedEnvelope } from "./model";

// The backend's generated OpenAPI is also the runtime shape contract, made
// tolerant of additive changes so a newer or older backend never blanks the
// screen: response enums are relaxed (a new value shows as unknown) and
// crit.damage may be missing (backends before backend #133).
const schemas = tolerantSchemas(contract.components.schemas);
schemas.CritSpeedCritResponse.required =
  schemas.CritSpeedCritResponse.required.filter((key) => key !== "damage");
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema({ $id: "crit-speed", components: { schemas } });
const envelope = ajv.compile<CritSpeedEnvelope>({
  $ref: "crit-speed#/components/schemas/ApiResponseCritSpeedResponse",
});

export function isCritSpeedEnvelope(value: unknown): value is CritSpeedEnvelope {
  return (
    envelope(value) &&
    value.code === "CHARACTER_CRIT_SPEED_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.fetchedAt))
  );
}
