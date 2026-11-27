import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/refining.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { PlanEnvelope } from "./model";
import type { AdvancedEnvelope } from "./advanced";
import type { SpecialEnvelope } from "./special";

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

// M42 특수 재련 돌파석 가치 (api #1099): the same contract file. status is a closed set (a new value is a breaking
// change, contract), so it is checked as written; the other enums stay tolerant like the plans'.
const special = lazyValidator<SpecialEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({
    $id: "refining",
    components: { schemas: tolerantSchemas(contract.components.schemas) },
  });
  return ajv.compile<SpecialEnvelope>({
    $ref: "refining#/components/schemas/ApiResponseSpecialStoneValuesResponse",
  });
});

const STATUSES = new Set(["OK", "UNSUPPORTED", "PRICE_MISSING"]);

export function isSpecialEnvelope(value: unknown): value is SpecialEnvelope {
  return (
    special(value) &&
    value.code === "REFINING_SPECIAL_STONE_SUCCESS" &&
    Array.isArray(value.data?.rows) &&
    value.data.rows.every((row) => STATUSES.has(row.status))
  );
}