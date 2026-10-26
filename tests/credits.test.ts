import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ADAPTED, ASSETS, DEPENDENCY_CREDITS, LIBRARIES } from "../lib/credits";

const all = [...ADAPTED, ...ASSETS, ...LIBRARIES];

test("credits: every runtime dependency is listed on the page", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const names = new Set(LIBRARIES.map((c) => c.name));
  for (const dep of Object.keys(pkg.dependencies)) {
    const credit = DEPENDENCY_CREDITS[dep];
    assert.ok(credit, `${dep}: add it to lib/credits.ts`);
    assert.ok(names.has(credit), `${dep}: '${credit}' is not on the page`);
  }
});

test("credits: each entry has a licence and an https link; marketplace copies link to the original", () => {
  for (const c of all) {
    assert.ok(c.licence.trim(), c.name);
    assert.match(c.href, /^https:\/\//, c.name);
    if (c.source) assert.match(c.source.href, /^https:\/\/21st\.dev\/@[^/]+\/components\/[^/]+$/, c.name);
  }
  // The two parts copied through 21st.dev (components/ui/NOTICE-motiq) link back.
  assert.equal(ADAPTED.filter((c) => c.source).length, 2);
  assert.equal(new Set(all.map((c) => c.name)).size, all.length);
});
