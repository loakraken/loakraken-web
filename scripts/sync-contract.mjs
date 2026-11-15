import { readFile, writeFile, mkdir } from "node:fs/promises";
import { applyOptionalOverrides } from "./contract-optional-overrides.mjs";
import { readDropFlag, refuseDrops } from "./contract-drop-guard.mjs";

// Capture selected paths (and every schema they reference) from the backend's
// generated OpenAPI document into contracts/<name>.openapi.json.
// Until the next api release, sync from the api develop doc (or per contract): the web carries fields the api
// master doc lacks, and the sync refuses to drop anything the committed contract has unless --allow-drop is
// passed (contract-drop-guard.mjs).
const { allowDrop, rest } = readDropFlag(process.argv.slice(2));
const [source, name, ...paths] = rest;
if (!source || !name || !paths.length)
  throw new Error(
    "Usage: node scripts/sync-contract.mjs <generated-openapi.json> <name> <path>... [--allow-drop]",
  );
const document = JSON.parse(await readFile(source, "utf8"));
const schemas = {};
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (value.$ref) {
    const prefix = "#/components/schemas/";
    if (!value.$ref.startsWith(prefix))
      throw new Error(`Unsupported reference: ${value.$ref}`);
    const schema = value.$ref.slice(prefix.length);
    if (!Object.hasOwn(schemas, schema)) {
      if (!document.components.schemas[schema])
        throw new Error(`Missing schema: ${schema}`);
      schemas[schema] = document.components.schemas[schema];
      collect(schemas[schema]);
    }
  }
  for (const child of Object.values(value)) collect(child);
}
// Every path the source lacks, at once (the auction cell-history paths are develop-only until the api release).
const missing = paths.filter((path) => !document.paths?.[path]);
if (missing.length) throw new Error(`Path not found in this source:\n  ${missing.join("\n  ")}`);
const selected = {};
for (const path of paths) {
  selected[path] = document.paths[path];
  collect(document.paths[path]);
}
const file = `contracts/${name}.openapi.json`;
const contract = {
  openapi: document.openapi,
  info: { title: `LOAKraken ${name}`, version: document.info.version },
  paths: selected,
  components: { schemas: applyOptionalOverrides(name, schemas) },
};
const previous = await readFile(file, "utf8").then(JSON.parse, () => null);
refuseDrops(file, previous, contract, allowDrop);
await mkdir("contracts", { recursive: true });
await writeFile(file, JSON.stringify(contract, null, 2) + "\n");
console.log(
  `Exported ${paths.length} paths and ${Object.keys(schemas).length} schemas to ${file}`,
);
