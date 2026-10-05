import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/refining.openapi.json";
import type { PlanEnvelope } from "./model";

// The backend's generated OpenAPI is also the runtime shape contract.
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema({ $id: "refining", components: contract.components });
const plan = ajv.compile<PlanEnvelope>({
  $ref: "refining#/components/schemas/ApiResponseRefiningPlanResponse",
});

export function isPlanEnvelope(value: unknown): value is PlanEnvelope {
  return plan(value) && value.code === "REFINING_PLAN_SUCCESS";
}
