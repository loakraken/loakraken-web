import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/spec-up.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { SpecUpEnvelope } from "./model";
import type { GoalEnvelope } from "./goal";

// Backend #318's response shape, tolerant of new kinds and statuses.
const guide = lazyValidator<SpecUpEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({ $id: "spec-up", components: { schemas: tolerantSchemas(contract.components.schemas) } });
  return ajv.compile<SpecUpEnvelope>({ $ref: "spec-up#/components/schemas/ApiResponseSpecUpResponse" });
});

// api #455 goal path, same tolerance.
const goal = lazyValidator<GoalEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({ $id: "spec-up-goal", components: { schemas: tolerantSchemas(contract.components.schemas) } });
  return ajv.compile<GoalEnvelope>({ $ref: "spec-up-goal#/components/schemas/ApiResponseSpecUpGoalResponse" });
});

export function isGoalEnvelope(value: unknown): value is GoalEnvelope {
  return goal(value) && value.code === "SPEC_UP_GOAL_SUCCESS" && Number.isFinite(Date.parse(value.data.fetchedAt));
}

export function isSpecUpEnvelope(value: unknown): value is SpecUpEnvelope {
  return guide(value) && value.code === "SPEC_UP_SUCCESS" && Number.isFinite(Date.parse(value.data.fetchedAt));
}
