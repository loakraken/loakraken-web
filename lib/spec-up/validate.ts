import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/spec-up.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { SpecUpEnvelope } from "./model";
import type { GoalEnvelope } from "./goal";
import type { DetailEnvelope } from "./detail";
import type { PathEnvelope } from "./path";

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

// api #794 추천 순서, same tolerance (fetchedAt may be null there).
const path = lazyValidator<PathEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({ $id: "spec-up-path", components: { schemas: tolerantSchemas(contract.components.schemas) } });
  return ajv.compile<PathEnvelope>({ $ref: "spec-up-path#/components/schemas/ApiResponseSpecUpPathResponse" });
});

export function isPathEnvelope(value: unknown): value is PathEnvelope {
  return path(value) && value.code === "SPEC_UP_PATH_SUCCESS";
}

export function isSpecUpEnvelope(value: unknown): value is SpecUpEnvelope {
  return guide(value) && value.code === "SPEC_UP_SUCCESS" && Number.isFinite(Date.parse(value.data.fetchedAt));
}

// api #550 줄 상세, same tolerance.
const detail = lazyValidator<DetailEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({ $id: "spec-up-detail", components: { schemas: tolerantSchemas(contract.components.schemas) } });
  return ajv.compile<DetailEnvelope>({ $ref: "spec-up-detail#/components/schemas/ApiResponseSpecUpDetailResponse" });
});

export function isDetailEnvelope(value: unknown): value is DetailEnvelope {
  return detail(value) && value.code === "SPEC_UP_DETAIL_SUCCESS" && Number.isFinite(Date.parse(value.data.fetchedAt));
}
