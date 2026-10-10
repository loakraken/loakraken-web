import { readFile, writeFile, mkdir } from "node:fs/promises";

const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: node scripts/sync-character-contract.mjs <generated-openapi.json>",
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
await mkdir("contracts", { recursive: true });
await writeFile(
  "contracts/character.openapi.json",
  JSON.stringify(
    {
      openapi: document.openapi,
      info: {
        title: "LOAKraken character search",
        version: document.info.version,
      },
      paths: { [path]: document.paths[path] },
      components: { schemas },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Exported character search and ${Object.keys(schemas).length} schemas`,
);
