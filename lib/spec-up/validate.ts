import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/spec-up.openapi.json";
import { lazyValidator } from "../api/lazy-validator";
import { tolerantSchemas } from "../tools/contract";
import type { SpecUpEnvelope } from "./model";

// Backend #318's response shape, tolerant of new kinds and statuses.
const guide = lazyValidator<SpecUpEnvelope>(() => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema({ $id: "spec-up", components: { schemas: tolerantSchemas(contract.components.schemas) } });
  return ajv.compile<SpecUpEnvelope>({ $ref: "spec-up#/components/schemas/ApiResponseSpecUpResponse" });
});

export function isSpecUpEnvelope(value: unknown): value is SpecUpEnvelope {
  return guide(value) && value.code === "SPEC_UP_SUCCESS" && Number.isFinite(Date.parse(value.data.fetchedAt));
}
