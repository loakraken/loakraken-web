import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { priceBases } from "../lib/market/model";
import { PARTY_PRESETS } from "../lib/tools/auction";
import { SEGMENTED_LABEL_PX, labelWidth, segmentedRowWidth } from "../lib/ui/segmented-width";

test("the label size the row width assumes is --text-body", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const body = /--text-body:\s*([\d.]+)px/.exec(css);
  assert.ok(body, "--text-body in px");
  assert.equal(Number(body[1]), SEGMENTED_LABEL_PX);
});

test("labels are bounded by the widest face: Hangul 1em, spaces 0.28em, digits 0.63em", () => {
  assert.equal(labelWidth("가"), 14);
  assert.equal(Math.round(labelWidth("가 나") * 100) / 100, 31.92);
  assert.equal(Math.round(labelWidth("30") * 100) / 100, 17.64);
});

test("price bases: one row needs 333.8px, so 390 (card 334px) keeps a row and 375 (319px) stacks", () => {
  const need = segmentedRowWidth(priceBases.map((b) => b.label));
  assert.equal(need, 333.8);
  assert.ok(need <= 390 - 56, "390 keeps one row");
  assert.ok(need > 375 - 56, "375 stacks");
});

test("auction party presets (12px sides) still fit the 254px side column", () => {
  assert.ok(segmentedRowWidth(PARTY_PRESETS.map((p) => p.label), 12) <= 254);
});
