import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The theme menu previews (--preview-<theme>-*) must equal the tokens they show:
// each theme's --background (page), --secondary (card step) and --foreground (text).
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Custom properties of the theme block `selector {` (the one that sets --background; others share the selector). */
function block(selector: string) {
  for (let start = css.indexOf(`\n${selector} {`); start !== -1; start = css.indexOf(`\n${selector} {`, start + 1)) {
    const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
    const props = Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    if (props.background) return props;
  }
  assert.fail(`no theme block for ${selector}`);
}

test("theme previews equal each theme's page, card step and text tokens", () => {
  const light = block(":root");
  const dark = block(':root:is([data-theme="dark"], [data-theme="dim"])');
  // Dim starts from the dark tokens and overrides some.
  const dim = { ...dark, ...block(':root[data-theme="dim"]') };
  const previews = Object.fromEntries(
    [...css.matchAll(/--preview-(light|dim|dark)-(page|card|text):\s*([^;]+);/g)].map((m) => [`${m[1]}-${m[2]}`, m[3].trim()]),
  );
  const token = { page: "background", card: "secondary", text: "foreground" } as const;
  for (const [theme, tokens] of Object.entries({ light, dim, dark }))
    for (const [part, name] of Object.entries(token))
      assert.equal(previews[`${theme}-${part}`], tokens[name], `--preview-${theme}-${part} = ${theme} --${name}`);
  // 딤 and 다크 differ in every part.
  for (const part of Object.keys(token)) assert.notEqual(previews[`dim-${part}`], previews[`dark-${part}`], part);
});
