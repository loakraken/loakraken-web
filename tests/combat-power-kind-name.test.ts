import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { KIND_LABEL, kindName } from "../lib/combat-power/model";

// web #1979 (PM 총괄 11-28, api #1129): a row the 2부 guard holds has only its kind, so every kind needs a Korean name.
const contract = JSON.parse(readFileSync(new URL("../contracts/combat-power.openapi.json", import.meta.url), "utf8")) as {
  components: { schemas: Record<string, { properties?: { kind?: { enum?: string[] } } }> };
};
const contractKinds = [
  ...new Set(Object.values(contract.components.schemas).flatMap((schema) => schema.properties?.kind?.enum ?? [])),
];

test("combat-power kinds: every kind the contract lists has a Korean name", () => {
  assert.ok(contractKinds.length >= 13, "the contract lists the change kinds");
  for (const kind of contractKinds) {
    assert.ok(Object.hasOwn(KIND_LABEL, kind), `${kind} has no label`);
    assert.doesNotMatch(kindName(kind), /[A-Z_]{4,}/, kind);
  }
});

test("combat-power kinds: an unknown kind reads '기타 항목', never the code", () => {
  assert.equal(kindName("SOMETHING_NEW"), "기타 항목");
  assert.equal(kindName("toString"), "기타 항목");
  assert.equal(kindName("EQUIPMENT_QUALITY"), "품질");
});
