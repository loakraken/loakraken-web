import assert from "node:assert/strict";
import test from "node:test";
import { cutoutPortrait } from "../lib/character/portrait-cutout";

const W = 20;
const H = 20;
function image(paint: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * W + x) * 4);
    }
  return data;
}
const at = (data: Uint8ClampedArray, x: number, y: number) =>
  Array.from(data.slice((y * W + x) * 4, (y * W + x) * 4 + 4));

// Dark backdrop, bright subject ring (6..13) with a dark "clothing" core (9..10),
// and a dim red glow column at x=3 connected to the border.
const scene = (x: number, y: number): [number, number, number] => {
  const ring = x >= 6 && x <= 13 && y >= 6 && y <= 13;
  const core = x >= 9 && x <= 10 && y >= 9 && y <= 10;
  if (core) return [24, 24, 26];
  if (ring) return [200, 180, 150];
  if (x === 3) return [18 + 40, 19, 22]; // backdrop + red glow at ~half strength
  return [18, 19, 22];
};

test("border-connected backdrop becomes transparent, subject and enclosed dark detail stay opaque", () => {
  const data = image(scene);
  const result = cutoutPortrait(data, W, H);
  assert.ok(result);
  assert.equal(at(data, 0, 0)[3], 0);
  assert.equal(at(data, 18, 18)[3], 0);
  assert.equal(at(data, 7, 7)[3], 255, "bright subject");
  assert.equal(
    at(data, 9, 9)[3],
    255,
    "dark clothing enclosed by the subject is kept",
  );
});

test("soft glow keeps its colour as partial transparency (un-blended from the backdrop)", () => {
  const data = image(scene);
  cutoutPortrait(data, W, H);
  const [r, g, b, a] = at(data, 3, 5);
  assert.ok(a > 0 && a < 255, `alpha ${a}`);
  assert.ok(r > 58 && r > g * 3 && r > b * 3, `recovered colour ${[r, g, b]}`);
});

test("ambient colour follows the lit subject and bright backdrops are rejected", () => {
  const data = image(scene);
  const result = cutoutPortrait(data, W, H);
  assert.ok(result?.ambient);
  assert.ok(result.ambient[0] > result.ambient[2]);
  assert.equal(
    cutoutPortrait(
      image(() => [240, 240, 240]),
      W,
      H,
    ),
    null,
  );
  assert.equal(
    cutoutPortrait(
      image(() => [20, 90, 20]),
      W,
      H,
    ),
    null,
  );
});

test("glow tint keeps the hue, lifts dull colours and keeps greys neutral", async () => {
  const { glowTint } = await import("../lib/character/portrait-cutout");
  const hsl = ([r, g, b]: readonly number[]) => {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    return { l: (max + min) / 2, spread: max - min };
  };
  const orange = glowTint([150, 80, 40]);
  assert.ok(orange[0] > orange[1] && orange[1] > orange[2], "hue order kept");
  assert.ok(Math.abs(hsl(orange).l - 0.55) < 0.01, "lightness pinned");
  assert.ok(hsl(orange).spread > hsl([150, 80, 40]).spread, "saturation lifted");
  const grey = glowTint([120, 120, 125]);
  assert.ok(hsl(grey).spread < 0.1, "near grey stays near grey");
  const blue = glowTint([30, 60, 200]);
  assert.ok(blue[2] > blue[0] && blue[2] > blue[1]);
});
