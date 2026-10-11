import assert from "node:assert/strict";
import test from "node:test";
import { curve } from "../components/ui/bencho/balance-curve";

// #432 (PM-프론트 P1): the line must never show a price outside what was
// recorded. Sample the drawn curve finely and read the values back.
const H = 200;
const PAD = 10;

function drawnRange(vals: number[]) {
  const c = curve(vals, 300, H, PAD);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  // y → value on the same scale curve() used.
  const value = (y: number) => lo + ((H - PAD - y) / (H - PAD * 2)) * (hi - lo || 1);
  const seen: number[] = [];
  const perSegment: { min: number; max: number; a: number; b: number }[] = [];
  for (let i = 0; i < vals.length - 1; i++) {
    let min = Infinity;
    let max = -Infinity;
    for (let k = 0; k <= 200; k++) {
      const v = value(c.at(i + k / 200).y);
      seen.push(v);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    perSegment.push({ min, max, a: vals[i], b: vals[i + 1] });
  }
  return { min: Math.min(...seen), max: Math.max(...seen), perSegment };
}

const EPS = 1e-6;
const samples = [
  [100, 100, 200, 200, 200],
  [100, 100, 100, 300, 300, 300],
  [50, 60, 55, 200, 210, 205],
];

for (const vals of samples) {
  test(`balance curve stays inside the recorded range: ${vals.join(",")}`, () => {
    const { min, max, perSegment } = drawnRange(vals);
    assert.ok(Math.abs(min - Math.min(...vals)) < EPS, `drawn min ${min}`);
    assert.ok(Math.abs(max - Math.max(...vals)) < EPS, `drawn max ${max}`);
    for (const s of perSegment) {
      assert.ok(s.min >= Math.min(s.a, s.b) - EPS && s.max <= Math.max(s.a, s.b) + EPS, `segment ${s.a}→${s.b} drew ${s.min}–${s.max}`);
    }
  });
}

test("balance curve still passes through every reading", () => {
  const vals = [50, 60, 55, 200, 210, 205];
  const c = curve(vals, 300, H, PAD);
  vals.forEach((_, i) => {
    assert.ok(Math.abs(c.at(i).y - c.pt[i].y) < EPS);
    assert.ok(Math.abs(c.at(i).x - c.pt[i].x) < EPS);
  });
});

test("two readings draw a straight line", () => {
  const c = curve([10, 20], 100, H, PAD);
  const mid = c.at(0.5);
  assert.ok(Math.abs(mid.y - (c.pt[0].y + c.pt[1].y) / 2) < EPS);
});
