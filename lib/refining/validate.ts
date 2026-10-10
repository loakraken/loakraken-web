import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/refining.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { PlanEnvelope } from "./model";

// The backend's generated OpenAPI is also the runtime shape contract; response
// enums are relaxed so a newly added value does not fail the whole plan.
// Compiled on first use, not at import (frontend #291).
const plan = lazyValidator<PlanEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({
    $id: "refining",
    components: { schemas: tolerantSchemas(contract.components.schemas) },
  });
  return ajv.compile<PlanEnvelope>({
    $ref: "refining#/components/schemas/ApiResponseRefiningPlanResponse",
  });
});

export function isPlanEnvelope(value: unknown): value is PlanEnvelope {
  return plan(value) && value.code === "REFINING_PLAN_SUCCESS";
}
