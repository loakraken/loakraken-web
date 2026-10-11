// MIT © 2026 Lorenzo Cabra — https://bencho.dev (block "Pull to refresh")
// The chart part of Bencho "Pull to refresh" (its Balance card): the curve
// builder, kept as published (full licence in ./NOTICE). Our only change
// (direction rule 10-10): it is exported on its own so the market and
// character history charts can draw their line with it.

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
  const seg = pt.slice(0, -1).map((p1, i) => {
    const p0 = pt[i - 1] ?? p1;
    const p2 = pt[i + 1];
    const p3 = pt[i + 2] ?? p2;
    /* a sixth of the neighbour span is the standard Catmull-Rom
       tension — tighter and it corners, looser and it loops */
    return {
      p1,
      p2,
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
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
