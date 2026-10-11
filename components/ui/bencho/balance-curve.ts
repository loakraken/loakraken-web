// MIT © 2026 Lorenzo Cabra — https://bencho.dev (block "Pull to refresh")
// The chart part of Bencho "Pull to refresh" (its Balance card): the curve
// builder, published with the full licence in ./NOTICE. Our changes:
// - exported on its own so the market chart can draw its line with it
//   (direction rule 10-10);
// - the tangents (#432, PM-프론트 P1): uniform Catmull-Rom does overshoot
//   where a flat run meets a change — [100,100,200,200,200] drew 92.6–207.4,
//   prices that were never recorded. The control points now come from
//   monotone cubic tangents (Fritsch–Carlson, as d3's curveMonotoneX), so
//   between two readings the line never leaves the range they span. Shape
//   of the API, the path string and `at` are otherwise as published.

/* ── the line ──────────────────────────────────────────────
   A CURVE, not a polyline. The first version joined the
   readings with straight segments and every one of those
   corners is a lie about data that was never sampled — it
   also looks like a sales chart from 1998, which was the
   actual complaint.

   Catmull-Rom converted to cubic béziers: the curve passes
   through every reading exactly, and the control points come
   from the neighbours on either side, so nothing is invented
   and nothing overshoots into a shape the data does not have.
   (Ours: monotone tangents in place of Catmull-Rom's — see the
   file header — because Catmull-Rom alone does overshoot.)

   Three things come out of one pass — the stroke, the area
   underneath it, and the points themselves — because they all
   have to agree. Generating them separately is how a fill ends
   up a pixel off the line it is under, and how a scrub dot
   ends up beside the curve instead of on it. */
export function curve(vals: number[], w: number, h: number, pad: number) {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pt = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * w,
    y: h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2),
  }));

  /* the control points, kept rather than thrown away with the
     string. `at` needs exactly these — see below. */
  /* Monotone tangents (Fritsch–Carlson). The slope at a reading is 0 where
     the line turns (a peak, a trough or a flat run), otherwise the smaller
     neighbour slope capped by their mean — which keeps each bézier inside
     the two readings it joins. The ends take the one-sided form. */
  const step = pt.length > 1 ? pt[1].x - pt[0].x : 1;
  const slope = pt.slice(0, -1).map((p1, i) => (pt[i + 1].y - p1.y) / (step || 1));
  const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const inner = pt.map((_, i) => {
    const s0 = slope[i - 1];
    const s1 = slope[i];
    if (s0 === undefined || s1 === undefined) return 0;
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs((s0 + s1) / 2)) || 0;
  });
  const tangent = inner.map((m, i) => {
    if (pt.length === 2) return slope[0];
    if (i === 0) return (3 * slope[0] - inner[1]) / 2;
    if (i === pt.length - 1) return (3 * slope[i - 1] - inner[i - 1]) / 2;
    return m;
  });
  const seg = pt.slice(0, -1).map((p1, i) => {
    const p2 = pt[i + 1];
    const third = (p2.x - p1.x) / 3;
    return {
      p1,
      p2,
      c1: { x: p1.x + third, y: p1.y + tangent[i] * third },
      c2: { x: p2.x - third, y: p2.y - tangent[i + 1] * third },
    };
  });

  let d = `M${pt[0].x.toFixed(2)} ${pt[0].y.toFixed(2)}`;
  for (const g of seg) {
    d += ` C${g.c1.x.toFixed(2)} ${g.c1.y.toFixed(2)} ${g.c2.x.toFixed(2)} ${g.c2.y.toFixed(2)} ${g.p2.x.toFixed(2)} ${g.p2.y.toFixed(2)}`;
  }

  /* ── anywhere along the line, not just at a reading ────────
     The same cubic the path string is made of, evaluated at a
     fractional index. That is the whole reason the control
     points are kept: lerping between two readings would put
     the dot on the CHORD, which is beside the curve wherever
     it bends — and "beside the curve" is exactly the bug the
     note above this function warns about. Reading the drawn
     path back with getPointAtLength would also work and would
     be a measurement of a thing we already know. */
  const at = (u: number) => {
    const i = Math.min(seg.length - 1, Math.max(0, Math.floor(u)));
    const g = seg[i];
    const t = Math.min(1, Math.max(0, u - i));
    const m = 1 - t;
    return {
      x: m ** 3 * g.p1.x + 3 * m * m * t * g.c1.x + 3 * m * t * t * g.c2.x + t ** 3 * g.p2.x,
      y: m ** 3 * g.p1.y + 3 * m * m * t * g.c1.y + 3 * m * t * t * g.c2.y + t ** 3 * g.p2.y,
    };
  };

  return { d, area: `${d} L${w} ${h} L0 ${h} Z`, pt, at };
}
