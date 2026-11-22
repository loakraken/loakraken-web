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

// 상급 재련 (api #1091, web #1951): the same contract file; the page reads the bands through advancedView.
// The api answers null in these four (its contract record §3 and the fields' own descriptions say so, and its CI
// sample has them), but the generated document types them without null. Allowed here, exactly these, until the api
// marks them nullable (asked 11-22); a property gone from the contract throws, so a stale entry is seen at once.
const NULLABLE: Record<string, string[]> = {
  AdvancedRefiningPlanResponse: ["expectedSilver"],
  AdvancedRefiningBandResponse: ["expectedSilver"],
  AdvancedRefiningTurnsResponse: ["enhanced"],
  AdvancedRefiningPolicyResponse: ["enhanced"],
};
type Schema = { type?: string | string[]; properties?: Record<string, Schema> };
function withNullable(schemas: Record<string, Schema>): Record<string, Schema> {
  const out = { ...schemas };
  for (const [name, props] of Object.entries(NULLABLE)) {
    const schema = out[name];
    const properties = { ...schema?.properties };
    for (const prop of props) {
      const field = properties[prop];
      if (!field) throw new Error(`refining contract: ${name}.${prop} is gone; drop it from NULLABLE`);
      const types = ([] as string[]).concat(field.type ?? []);
      properties[prop] = { ...field, type: types.includes("null") ? types : [...types, "null"] };
    }
    out[name] = { ...schema, properties };
  }
  return out;
}
const advanced = lazyValidator<AdvancedEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({
    $id: "refining",
    components: { schemas: withNullable(tolerantSchemas(contract.components.schemas) as Record<string, Schema>) },
  });
  return ajv.compile<AdvancedEnvelope>({
    $ref: "refining#/components/schemas/ApiResponseAdvancedRefiningPlanResponse",
  });
});

export function isAdvancedEnvelope(value: unknown): value is AdvancedEnvelope {
  return advanced(value) && value.code === "REFINING_ADVANCED_PLAN_SUCCESS" && Array.isArray(value.data?.bands);
}
