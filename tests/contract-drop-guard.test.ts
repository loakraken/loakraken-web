import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { droppedFields, readDropFlag } from "../scripts/contract-drop-guard.mjs";
import { OPTIONAL_OVERRIDES } from "../scripts/contract-optional-overrides.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const root = fileURLToPath(new URL("..", import.meta.url));
const committed = (name: string): Json =>
  JSON.parse(readFileSync(join(root, "contracts", `${name}.openapi.json`), "utf8"));
const copy = <T>(value: T): T => structuredClone(value);

test("a committed contract re-synced as is drops nothing", () => {
  for (const file of readdirSync(join(root, "contracts")).filter((f) => f.endsWith(".openapi.json"))) {
    const contract = committed(file.replace(".openapi.json", ""));
    assert.deepEqual(droppedFields(contract, copy(contract)), [], file);
  }
});

test("no committed contract yet: nothing to drop", () => {
  assert.deepEqual(droppedFields(null, committed("market")), []);
});

test("lists each kind of drop, and nothing for additions or reworded text", () => {
  const base = {
    paths: {
      "/a": {
        get: {
          description: "429 SPEC_UP_BUSY when busy",
          responses: { "200": { description: "ok" }, "429": { description: "CLIENT_RATE_LIMITED or SPEC_UP_BUSY" } },
        },
      },
      "/b": { post: { responses: { "200": { description: "ok" } } } },
    },
    components: {
      schemas: {
        Row: {
          type: "object",
          properties: {
            range: { type: "string", enum: ["30d", "90d", "365d"] },
            days: { type: "array", items: { type: "object", properties: { storedDays: { type: "integer" } } } },
          },
        },
        Gone: { type: "object" },
      },
    },
  };
  const next = copy(base) as Json;
  delete next.paths["/b"];
  delete next.paths["/a"].get.responses["429"];
  next.paths["/a"].get.description = "429 when busy";
  next.components.schemas.Row.properties.range.enum = ["30d"];
  delete next.components.schemas.Row.properties.days.items.properties.storedDays;
  delete next.components.schemas.Gone;
  assert.deepEqual(droppedFields(base, next), [
    "GET /a names SPEC_UP_BUSY",
    "GET /a → 429",
    "GET /a → 429 names CLIENT_RATE_LIMITED",
    "GET /a → 429 names SPEC_UP_BUSY",
    "POST /b → 200",
    "Row.days[].storedDays",
    'Row.range enum "365d"',
    'Row.range enum "90d"',
    "operation POST /b",
    "path /b",
    "schema Gone",
  ]);
  const grown = copy(base) as Json;
  grown.paths["/a"].get.description = "429 SPEC_UP_BUSY (reworded), also NEW_CODE";
  grown.components.schemas.Row.properties.extra = { type: "string" };
  grown.components.schemas.Row.properties.range.enum.push("7d");
  assert.deepEqual(droppedFields(base, grown), []);
});

test("the develop-only market fields count as drops when a source lacks them", () => {
  const market = committed("market");
  const schemas = market.components.schemas;
  const holder = Object.keys(schemas).find((name) => schemas[name].properties?.storedDays);
  assert.ok(holder, "a market schema has storedDays");
  const next = copy(market);
  for (const prop of ["range", "recordedSince", "storedDays"]) delete next.components.schemas[holder].properties[prop];
  const dropped = droppedFields(market, next);
  assert.ok(dropped.includes(`${holder}.storedDays`), dropped.join("\n"));
  assert.ok(dropped.includes(`${holder}.recordedSince`), dropped.join("\n"));
});

test("--allow-drop is read out of the arguments", () => {
  assert.deepEqual(readDropFlag(["doc.json", "--allow-drop", "market", "/a"]), {
    allowDrop: true,
    rest: ["doc.json", "market", "/a"],
  });
  assert.deepEqual(readDropFlag(["doc.json"]), { allowDrop: false, rest: ["doc.json"] });
});

// The real script, in a scratch folder holding a copy of the committed spec-up contract. The source is that
// contract as the backend writes it (the overridden fields required again): once as is, once without the
// goal's SPEC_UP_BUSY 429 text (the api master doc before the release that ships it).
test("sync-contract refuses a source that would drop a committed field, unless --allow-drop", () => {
  const dir = mkdtempSync(join(tmpdir(), "contract-drop-"));
  try {
    const contract = committed("spec-up");
    const backend = copy(contract);
    for (const [schema, props] of Object.entries((OPTIONAL_OVERRIDES as Json)["spec-up"] as Record<string, string[]>))
      backend.components.schemas[schema].required = [...(backend.components.schemas[schema].required ?? []), ...props];
    const master = copy(backend);
    const busy = master.paths["/api/v1/characters/spec-up/goal"].get.responses["429"];
    busy.description = busy.description.replace(/SPEC_UP_BUSY: [^/]*\/ /, "");
    assert.ok(!busy.description.includes("SPEC_UP_BUSY"));
    writeFileSync(join(dir, "develop.json"), JSON.stringify(backend));
    writeFileSync(join(dir, "master.json"), JSON.stringify(master));
    mkdirSync(join(dir, "contracts"));
    const target = join(dir, "contracts", "spec-up.openapi.json");
    const before = readFileSync(join(root, "contracts", "spec-up.openapi.json"), "utf8");
    writeFileSync(target, before);
    const sync = (source: string, ...extra: string[]) =>
      spawnSync(
        process.execPath,
        [join(root, "scripts", "sync-contract.mjs"), source, "spec-up", ...Object.keys(contract.paths), ...extra],
        { cwd: dir, encoding: "utf8" },
      );

    const refused = sync("master.json");
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /GET \/api\/v1\/characters\/spec-up\/goal → 429 names SPEC_UP_BUSY/);
    assert.match(refused.stderr, /--allow-drop/);
    assert.equal(readFileSync(target, "utf8"), before, "nothing written");

    const same = sync("develop.json");
    assert.equal(same.status, 0, same.stderr);
    assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), contract, "the develop source re-syncs to the committed contract");

    const allowed = sync("master.json", "--allow-drop");
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.match(allowed.stderr, /dropping 1 \(--allow-drop\)/);
    assert.ok(!readFileSync(target, "utf8").includes("SPEC_UP_BUSY: 목표"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
