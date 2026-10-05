import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/crit-speed.openapi.json";
import type { CritSpeedEnvelope } from "./model";

// The backend's generated OpenAPI is also the runtime shape contract.
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema({ $id: "crit-speed", components: contract.components });
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
