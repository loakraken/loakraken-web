import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  OPTIONAL_OVERRIDES,
  applyOptionalOverrides,
} from "../scripts/contract-optional-overrides.mjs";

type Schema = { required?: string[]; properties?: Record<string, unknown> };
const contract = (name: string): Record<string, Schema> =>
  JSON.parse(
    readFileSync(new URL(`../contracts/${name}.openapi.json`, import.meta.url), "utf8"),
  ).components.schemas;

test("every optional override names an optional property of the committed contract", () => {
  let count = 0;
  for (const [name, schemas] of Object.entries(OPTIONAL_OVERRIDES)) {
    const committed = contract(name);
    for (const [schema, props] of Object.entries(schemas as Record<string, string[]>)) {
      assert.ok(committed[schema], `${name}.${schema} is in the contract`);
      for (const prop of props) {
        assert.ok(committed[schema].properties?.[prop], `${name}.${schema}.${prop} exists`);
        assert.ok(
          !committed[schema].required?.includes(prop),
          `${name}.${schema}.${prop} is optional in the web`,
        );
        count++;
      }
    }
  }
  assert.ok(count > 0);
});

const backend = () => ({
  ThingResponse: {
    type: "object",
    required: ["id", "fresh", "extra"],
    properties: { id: {}, fresh: {}, extra: {} },
    description: "after required",
  },
  OnlyNewResponse: { required: ["late"], properties: { late: {} } },
  UntouchedResponse: { required: ["id"], properties: { id: {} } },
});
const overrides = { demo: { ThingResponse: ["fresh", "extra"], OnlyNewResponse: ["late"] } };

test("applyOptionalOverrides drops only the listed names and keeps key order", () => {
  const input = backend();
  const out = applyOptionalOverrides("demo", input, overrides);
  assert.deepEqual(out.ThingResponse.required, ["id"]);
  assert.deepEqual(Object.keys(out.ThingResponse), [
    "type",
    "required",
    "properties",
    "description",
  ]);
  assert.equal("required" in out.OnlyNewResponse, false, "empty required is dropped");
  assert.equal(out.UntouchedResponse, input.UntouchedResponse);
  assert.deepEqual(input.ThingResponse.required, ["id", "fresh", "extra"], "not mutated");
  assert.equal(applyOptionalOverrides("other", input, overrides).ThingResponse, input.ThingResponse);
});

test("applyOptionalOverrides fails when an override no longer matches", () => {
  const without = (change: (schemas: ReturnType<typeof backend>) => void) => {
    const schemas = backend();
    change(schemas);
    return () => applyOptionalOverrides("demo", schemas, overrides);
  };
  assert.throws(
    without((s) => delete (s as Partial<typeof s>).OnlyNewResponse),
    /demo\.OnlyNewResponse: schema is not in this contract/,
  );
  assert.throws(
    without((s) => delete (s.ThingResponse.properties as Partial<typeof s.ThingResponse.properties>).extra),
    /demo\.ThingResponse\.extra: property is gone/,
  );
  assert.throws(
    without((s) => (s.ThingResponse.required = ["id", "extra"])),
    /demo\.ThingResponse\.fresh: the backend no longer requires it/,
  );
});
