import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Every <img> that shows an address from the API goes through safeGameImage
// (official armory hosts only), so a changed or poisoned icon field shows no
// picture instead of loading from anywhere. The src is a name the same file
// sets from safeGameImage, or one of these fixed sources.
const FIXED: Record<string, string> = {
  // The landing preview's sample character: a constant official emblem.
  "components/landing/cockpit.tsx": "hero.emblem",
  // Empty since the template's own pictures were dropped.
  "components/ui/bencho/reorder-list.tsx": "AVATARS[p.id]",
  // Callers pass safeGameImage results (command search).
  "components/ui/bencho/result-panel.tsx": "item.avatar.src",
  // A usage example inside a comment.
  "components/ui/item-tooltip.tsx": "api",
};

const files = ["components", "app"].flatMap((dir) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => join(dir, file).replace(/\\/g, "/")),
);

test("API image addresses are drawn only through safeGameImage", () => {
  let checked = 0;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const [, src] of source.matchAll(/<img\b[^>]*?\bsrc=\{([^}]+)\}/g)) {
      checked++;
      if (FIXED[file] === src) continue;
      assert.match(src, /^\w+$/, `${file}: <img src={${src}}> reads the field directly`);
      assert.match(source, new RegExp(`\\b${src} = safeGameImage\\(`), `${file}: ${src} is not from safeGameImage`);
    }
  }
  assert.ok(checked >= 12);
});
