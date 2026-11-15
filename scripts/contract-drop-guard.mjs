// What a re-sync would take away from a committed web contract (codex #1659 follow-up).
//
// The web carries some api fields ahead of the api release they ship in (market range / recordedSince /
// storedDays, the auction cell-history paths, the spec-up goal's SPEC_UP_BUSY 429; api #920/#922/#928). A sync
// from a source that lacks them (the api master doc before that release) would silently drop them, and the
// generated types and response validation with them. So both sync scripts compare the new contract with the
// committed one and refuse to write while anything would be dropped, unless --allow-drop is passed.
//
// Until the next api release: sync from the api develop doc (or per contract, from the doc that has its paths).
//
// Counted as dropped: a path or operation, a response status, a schema, a property (inline ones too), an enum
// value, and an UPPER_SNAKE error code named in an operation's or a response's description. Added things and
// changed wording are not drops.

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
const codes = (text) => new Set(typeof text === "string" ? text.match(CODE) ?? [] : []);

/** Properties and enum values under `node`, by a readable path (`Schema.prop.inner`, `Schema.prop[]`). */
function shape(node, at, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.enum)) for (const value of node.enum) out.add(`${at} enum ${JSON.stringify(value)}`);
  for (const [prop, child] of Object.entries(node.properties ?? {})) {
    out.add(`${at}.${prop}`);
    shape(child, `${at}.${prop}`, out);
  }
  if (node.items) shape(node.items, `${at}[]`, out);
  if (node.additionalProperties && typeof node.additionalProperties === "object")
    shape(node.additionalProperties, `${at}{}`, out);
  for (const key of ["allOf", "oneOf", "anyOf"])
    if (Array.isArray(node[key])) node[key].forEach((part) => shape(part, at, out));
}

/** Everything in a contract a sync could drop, as readable names. */
function inventory(contract) {
  const out = new Set();
  for (const [path, item] of Object.entries(contract?.paths ?? {})) {
    out.add(`path ${path}`);
    for (const method of METHODS) {
      const operation = item?.[method];
      if (!operation) continue;
      const op = `${method.toUpperCase()} ${path}`;
      out.add(`operation ${op}`);
      for (const code of codes(operation.description)) out.add(`${op} names ${code}`);
      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        out.add(`${op} → ${status}`);
        for (const code of codes(response?.description)) out.add(`${op} → ${status} names ${code}`);
      }
    }
  }
  for (const [name, schema] of Object.entries(contract?.components?.schemas ?? {})) {
    out.add(`schema ${name}`);
    shape(schema, name, out);
  }
  return out;
}

/**
 * What `next` lacks that `previous` (the committed contract) has, sorted. Empty when nothing would be dropped.
 * @param {any} previous
 * @param {any} next
 * @returns {string[]}
 */
export function droppedFields(previous, next) {
  if (!previous) return [];
  const kept = inventory(next);
  return [...inventory(previous)].filter((name) => !kept.has(name)).sort();
}

/**
 * Splits `--allow-drop` out of the arguments.
 * @param {string[]} args
 */
export function readDropFlag(args) {
  return { allowDrop: args.includes("--allow-drop"), rest: args.filter((arg) => arg !== "--allow-drop") };
}

/**
 * Throws (listing them) when writing `next` over `previous` would drop anything and the drop is not allowed.
 * @param {string} file
 * @param {any} previous
 * @param {any} next
 * @param {boolean} allowDrop
 */
export function refuseDrops(file, previous, next, allowDrop) {
  const dropped = droppedFields(previous, next);
  if (!dropped.length) return dropped;
  if (allowDrop) {
    console.warn(`${file}: dropping ${dropped.length} (--allow-drop):\n  ${dropped.join("\n  ")}`);
    return dropped;
  }
  throw new Error(
    `${file}: this source lacks ${dropped.length} thing(s) the committed contract has, so the sync would drop them:\n  ` +
      `${dropped.join("\n  ")}\n` +
      "Sync from the api develop doc (or per contract) until the api release that ships them, or pass --allow-drop " +
      "when the drop is intended.",
  );
}
