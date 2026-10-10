import { readFile, writeFile, mkdir } from "node:fs/promises";

// Capture selected paths (and every schema they reference) from the backend's
// generated OpenAPI document into contracts/<name>.openapi.json.
const [source, name, ...paths] = process.argv.slice(2);
if (!source || !name || !paths.length)
  throw new Error(
    "Usage: node scripts/sync-contract.mjs <generated-openapi.json> <name> <path>...",
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
const selected = {};
for (const path of paths) {
  if (!document.paths?.[path]) throw new Error(`Path not found: ${path}`);
  selected[path] = document.paths[path];
  collect(document.paths[path]);
}
await mkdir("contracts", { recursive: true });
await writeFile(
  `contracts/${name}.openapi.json`,
  JSON.stringify(
    {
      openapi: document.openapi,
      info: { title: `LOAKraken ${name}`, version: document.info.version },
      paths: selected,
      components: { schemas },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Exported ${paths.length} paths and ${Object.keys(schemas).length} schemas to contracts/${name}.openapi.json`,
);
