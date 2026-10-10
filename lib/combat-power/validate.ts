import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/combat-power.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { OptionsEnvelope, SimulateEnvelope } from "./model";

// The backend's OpenAPI (backend #240) is the runtime shape contract, made
// tolerant of additive changes: response enums are relaxed so a new status or
// kind shows as unknown instead of blanking the screen.
const compile = <T>(ref: string) =>
  lazyValidator<T>(() => {
    const ajv = new Ajv2020({ strict: false, validateFormats: false });
    ajv.addSchema({
      $id: "combat-power",
      components: { schemas: tolerantSchemas(contract.components.schemas) },
    });
    return ajv.compile<T>({ $ref: `combat-power#/components/schemas/${ref}` });
  });

const simulate = compile<SimulateEnvelope>("ApiResponseCombatPowerSimulationResponse");
const options = compile<OptionsEnvelope>("ApiResponseCombatPowerOptionsResponse");

export function isSimulateEnvelope(value: unknown): value is SimulateEnvelope {
  return (
    simulate(value) &&
    value.code === "CHARACTER_COMBAT_POWER_SIMULATE_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.fetchedAt))
  );
}

export function isOptionsEnvelope(value: unknown): value is OptionsEnvelope {
  return options(value) && value.code === "CHARACTER_COMBAT_POWER_OPTIONS_SUCCESS";
}
