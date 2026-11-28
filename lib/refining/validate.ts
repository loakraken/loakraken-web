import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/refining.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { PlanEnvelope } from "./model";
import type { AdvancedEnvelope } from "./advanced";

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

// 상급 재련 (api #1091, web #1951): the same contract file; the page reads the bands through advancedView. Its null
// fields are marked nullable in the api document since api #1095 (web #1955 dropped the temporary allowance).
const advanced = lazyValidator<AdvancedEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({
    $id: "refining",
    components: { schemas: tolerantSchemas(contract.components.schemas) },
  });
  return ajv.compile<AdvancedEnvelope>({
    $ref: "refining#/components/schemas/ApiResponseAdvancedRefiningPlanResponse",
  });
});

export function isAdvancedEnvelope(value: unknown): value is AdvancedEnvelope {
  return advanced(value) && value.code === "REFINING_ADVANCED_PLAN_SUCCESS" && Array.isArray(value.data?.bands);
}
