import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/crit-speed.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { CritSpeedEnvelope } from "./model";

// The backend's generated OpenAPI is also the runtime shape contract, made
// tolerant of additive changes so a newer or older backend never blanks the
// screen: response enums are relaxed (a new value shows as unknown) and
// crit.damage may be missing (backends before backend #133), and so may the
// per-skill table (before backend #169; the screen does not show it yet, #206)
// and the conditional-effect toggles (before backend #193).
// Compiled on first use (proxy, server side), not when the screen imports
// labels from this module tree (frontend #291).
const envelope = lazyValidator<CritSpeedEnvelope>(() => {
  const schemas = tolerantSchemas(contract.components.schemas);
  schemas.CritSpeedCritResponse.required =
    schemas.CritSpeedCritResponse.required.filter((key) => key !== "damage");
  schemas.CritSpeedResponse.required =
    schemas.CritSpeedResponse.required.filter(
      (key) => key !== "skills" && key !== "toggles",
    );
  // Skill rows grow per backend release (#169 → #193 node·damage) and the screen
  // does not read them yet, so a row only needs its name.
  schemas.CritSpeedSkillResponse.required = ["name"];
  // Toggle rows gained axis after 3e7f7b2 (backend #193 5d661d7); older rows
  // without it default to the crit axis on screen.
  schemas.CritSpeedToggleResponse.required = ["key", "label", "on"];
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({ $id: "crit-speed", components: { schemas } });
  return ajv.compile<CritSpeedEnvelope>({
    $ref: "crit-speed#/components/schemas/ApiResponseCritSpeedResponse",
  });
});

export function isCritSpeedEnvelope(
  value: unknown,
): value is CritSpeedEnvelope {
  return (
    envelope(value) &&
    value.code === "CHARACTER_CRIT_SPEED_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.fetchedAt))
  );
}
