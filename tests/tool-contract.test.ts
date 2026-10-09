import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tolerantSchemas } from "../lib/tools/contract";
import { isCritSpeedEnvelope } from "../lib/crit-speed/validate";
import { isPlanEnvelope } from "../lib/refining/validate";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("tolerantSchemas drops response enums only and leaves the input intact", () => {
  const schemas = {
    ThingRequest: { properties: { kind: { type: "string", enum: ["A"] } } },
    ThingResponse: {
      required: ["kind"],
      properties: {
        kind: { type: "string", enum: ["A", "B"] },
        list: { type: "array", items: { type: "string", enum: ["X"] } },
      },
    },
  };
  const out = tolerantSchemas(schemas);
  assert.deepEqual(out.ThingRequest.properties.kind.enum, ["A"], "request enum kept");
  assert.equal("enum" in out.ThingResponse.properties.kind, false);
  assert.equal("enum" in out.ThingResponse.properties.list.items, false);
  assert.deepEqual(out.ThingResponse.required, ["kind"], "required kept");
  assert.deepEqual(schemas.ThingResponse.properties.kind.enum, ["A", "B"], "not mutated");
});

test("crit-speed accepts unknown enum values but still checks shapes", () => {
  const value = read("./crit-speed-fixtures/crit-speed.json");
  value.data.sources.push({
    kind: "ESTIMATED",
    category: "GEM",
    axis: "CRIT_DAMAGE",
    name: "새 출처",
    value: 8.4,
    text: "치명타 피해 +8.40%",
  });
  value.data.crit.bluntThorn.source = "NEW_SOURCE";
  assert.equal(isCritSpeedEnvelope(value), true);
  const wrongType = read("./crit-speed-fixtures/crit-speed.json");
  wrongType.data.sources[0].axis = 7;
  assert.equal(isCritSpeedEnvelope(wrongType), false);
  const missing = read("./crit-speed-fixtures/crit-speed.json");
  delete missing.data.sources[0].axis;
  assert.equal(isCritSpeedEnvelope(missing), false);
});

test("refining plan accepts an unknown grade but still checks shapes", () => {
  const value = read("./refining-fixtures/refining-plan.json");
  value.data.grade = "NEW_GRADE";
  value.data.equipmentType = "ACCESSORY";
  assert.equal(isPlanEnvelope(value), true);
  const wrongType = read("./refining-fixtures/refining-plan.json");
  wrongType.data.grade = 1;
  assert.equal(isPlanEnvelope(wrongType), false);
});
