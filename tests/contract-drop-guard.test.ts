import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { droppedFields, readBaseline, readDropFlag } from "../scripts/contract-drop-guard.mjs";
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
    "Gone type object",
    "POST /b → 200",
    "Row.days[].storedDays",
    "Row.days[].storedDays type integer",
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

// codex #1673 P2: a kept field whose type changes loses its old type — a source that predates a develop-only
// type change would revert it.
test("a kept field's type change is a drop: $ref retarget, a nullable member's type, a method without its path", () => {
  const base = {
    paths: { "/a": { get: { responses: { "200": { description: "ok" } } }, post: { responses: { "200": { description: "ok" } } } } },
    components: {
      schemas: {
        A: { type: "object", properties: { x: { type: "string" } } },
        B: { type: "object", properties: { y: { type: "string" } } },
        Row: {
          type: "object",
          properties: {
            payload: { $ref: "#/components/schemas/A" },
            other: { $ref: "#/components/schemas/A" },
            count: { anyOf: [{ type: "integer", format: "int64" }, { type: "null" }] },
            tags: { type: "array", items: { $ref: "#/components/schemas/B" } },
          },
        },
      },
    },
  };
  const retarget = copy(base) as Json;
  retarget.components.schemas.Row.properties.payload = { $ref: "#/components/schemas/B" };
  assert.deepEqual(droppedFields(base, retarget), ["Row.payload $ref #/components/schemas/A"]);
  const retyped = copy(base) as Json;
  retyped.components.schemas.Row.properties.count = { anyOf: [{ type: "string" }, { type: "null" }] };
  assert.deepEqual(droppedFields(base, retyped), ["Row.count type integer"]);
  const items = copy(base) as Json;
  items.components.schemas.Row.properties.tags.items = { $ref: "#/components/schemas/A" };
  assert.deepEqual(droppedFields(base, items), ["Row.tags[] $ref #/components/schemas/B"]);
  const method = copy(base) as Json;
  delete method.paths["/a"].post;
  assert.deepEqual(droppedFields(base, method), ["POST /a → 200", "operation POST /a"]);
  // Reordered members, the 3.1 list form of the same types, and a new member are not drops.
  const same = copy(base) as Json;
  same.components.schemas.Row.properties.count = { anyOf: [{ type: "null" }, { type: "integer" }, { type: "number" }] };
  assert.deepEqual(droppedFields(base, same), []);
  const listed = copy(base) as Json;
  listed.components.schemas.Row.properties.count = { type: ["integer", "null"] };
  assert.deepEqual(droppedFields(base, listed), []);
});

test("the committed contract: none when missing, a stop when broken (never overwritten unchecked)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "contract-baseline-"));
  try {
    assert.equal(await readBaseline(join(dir, "missing.json")), null);
    writeFileSync(join(dir, "broken.json"), '{\n<<<<<<< HEAD\n  "openapi": "3.1.0"\n');
    await assert.rejects(readBaseline(join(dir, "broken.json")), /not valid JSON/);
    writeFileSync(join(dir, "ok.json"), '{"openapi":"3.1.0"}');
    assert.deepEqual(await readBaseline(join(dir, "ok.json")), { openapi: "3.1.0" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

// The character script, the same way: a source that retypes a kept field stops; the develop-shaped source writes
// the committed contract back; a broken committed file stops without being overwritten.
test("sync-character-contract refuses a retyped field and a broken committed file", () => {
  const dir = mkdtempSync(join(tmpdir(), "contract-character-"));
  try {
    const contract = committed("character");
    const backend = copy(contract);
    for (const [schema, props] of Object.entries((OPTIONAL_OVERRIDES as Json).character as Record<string, string[]>))
      backend.components.schemas[schema].required = [...(backend.components.schemas[schema].required ?? []), ...props];
    const schemas = backend.components.schemas;
    const holder = Object.keys(schemas).find((name) =>
      Object.values(schemas[name].properties ?? {}).some((p: Json) => p.type === "integer"),
    )!;
    const prop = Object.keys(schemas[holder].properties).find((name) => schemas[holder].properties[name].type === "integer")!;
    const older = copy(backend);
    older.components.schemas[holder].properties[prop] = { ...older.components.schemas[holder].properties[prop], type: "string" };
    writeFileSync(join(dir, "develop.json"), JSON.stringify(backend));
    writeFileSync(join(dir, "older.json"), JSON.stringify(older));
    mkdirSync(join(dir, "contracts"));
    const target = join(dir, "contracts", "character.openapi.json");
    const before = readFileSync(join(root, "contracts", "character.openapi.json"), "utf8");
    writeFileSync(target, before);
    const sync = (source: string) =>
      spawnSync(process.execPath, [join(root, "scripts", "sync-character-contract.mjs"), source], { cwd: dir, encoding: "utf8" });

    const refused = sync("older.json");
    assert.notEqual(refused.status, 0);
    assert.ok(refused.stderr.includes(`${holder}.${prop} type integer`), refused.stderr);
    assert.equal(readFileSync(target, "utf8"), before, "nothing written");

    const same = sync("develop.json");
    assert.equal(same.status, 0, same.stderr);
    assert.equal(readFileSync(target, "utf8").replace(/\r\n/g, "\n"), before.replace(/\r\n/g, "\n"), "byte-identical");

    writeFileSync(target, before.slice(0, 200) + "\n<<<<<<< HEAD\n");
    const broken = sync("develop.json");
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr, /not valid JSON/);
    assert.ok(readFileSync(target, "utf8").includes("<<<<<<<"), "the broken file is left as it was");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
