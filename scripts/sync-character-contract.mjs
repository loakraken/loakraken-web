import { readFile, writeFile, mkdir } from "node:fs/promises";
import { applyOptionalOverrides } from "./contract-optional-overrides.mjs";
import { readDropFlag, refuseDrops } from "./contract-drop-guard.mjs";

// Until the next api release, sync from the api develop doc: the sync refuses to drop anything the committed
// contract has unless --allow-drop is passed (contract-drop-guard.mjs).
const { allowDrop, rest } = readDropFlag(process.argv.slice(2));
const source = rest[0];
if (!source)
  throw new Error(
    "Usage: node scripts/sync-character-contract.mjs <generated-openapi.json> [--allow-drop]",
  );
const document = JSON.parse(await readFile(source, "utf8"));
const path = "/api/v1/characters/search";
if (!document.paths?.[path])
  throw new Error("Character search contract not found");
const schemas = {};
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (value.$ref) {
    const prefix = "#/components/schemas/";
    if (!value.$ref.startsWith(prefix))
      throw new Error(`Unsupported reference: ${value.$ref}`);
    const name = value.$ref.slice(prefix.length);
    if (!Object.hasOwn(schemas, name)) {
      if (!document.components.schemas[name])
        throw new Error(`Missing schema: ${name}`);
      schemas[name] = document.components.schemas[name];
      collect(schemas[name]);
    }
  }
  for (const child of Object.values(value)) collect(child);
}
collect(document.paths[path]);
const file = "contracts/character.openapi.json";
const contract = {
  openapi: document.openapi,
  info: {
    title: "LOAKraken character search",
    version: document.info.version,
  },
  paths: { [path]: document.paths[path] },
  components: { schemas: applyOptionalOverrides("character", schemas) },
};
const previous = await readFile(file, "utf8").then(JSON.parse, () => null);
refuseDrops(`${file} (source ${source})`, previous, contract, allowDrop);
await mkdir("contracts", { recursive: true });
await writeFile(file, JSON.stringify(contract, null, 2) + "\n");
console.log(
  `Exported character search and ${Object.keys(schemas).length} schemas`,
);
