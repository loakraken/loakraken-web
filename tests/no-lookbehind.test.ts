import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Safari before 16.4 (iOS 16.3 and older) cannot parse a regex lookbehind: the
// whole chunk holding one fails to load (codex on #1352). Shipped code only.
const ROOTS = ["app", "components", "lib"];
const CODE = /\.(tsx?|jsx?|mjs)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "node_modules" && !name.startsWith(".")) walk(full, out);
    } else if (CODE.test(name) && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

test("no regex lookbehind ((?<= or (?<!) in app, components or lib", () => {
  const found = ROOTS.flatMap((root) => walk(root)).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) => (/\(\?<[=!]/.test(line) ? [`${file}:${i + 1}`] : [])),
  );
  assert.deepEqual(found, []);
});
