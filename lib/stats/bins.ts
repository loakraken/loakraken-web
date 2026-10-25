// Histogram bins for the distribution tab (stats gap A5): the backend answers
// in fine steps; the screen joins neighbours into a round width so a phone
// shows no more than about 40 bars, whatever the sample's range.

export type Bin = { from: number; to: number; count: number };

/** Round widths to join into, as multiples of the requested step. */
const STEPS = [1, 2, 2.5, 5, 10, 20, 25, 50, 100];

/**
 * Bins joined into the smallest round width (a multiple of the step) that
 * leaves at most `maxBars`. Each joined bin starts at a multiple of the new
 * width, so its labels stay round numbers. Bins already few enough stay as
 * they are.
 */
export function coarsen(bins: readonly Bin[], maxBars = 40): Bin[] {
  if (bins.length <= maxBars) return [...bins];
  const step = bins[0].to - bins[0].from;
  if (!(step > 0)) return [...bins];
  const first = bins[0].from;
  const last = bins.at(-1)!.to;
  for (const factor of STEPS.filter((f) => f > 1)) {
    const width = step * factor;
    const start = Math.floor(first / width) * width;
    if (Math.ceil((last - start) / width) <= maxBars) return join(bins, width, start);
  }
  // A range wider than the steps cover: an even split into maxBars round to the step.
  const width = Math.ceil((last - first) / maxBars / step) * step;
  return join(bins, width, Math.floor(first / width) * width);
}

function join(bins: readonly Bin[], width: number, start: number): Bin[] {
  const out = new Map<number, Bin>();
  for (const bin of bins) {
    const from = start + Math.floor((bin.from - start) / width) * width;
    const joined = out.get(from) ?? { from, to: from + width, count: 0 };
    joined.count += bin.count;
    out.set(from, joined);
  }
  return [...out.values()].sort((a, b) => a.from - b.from);
}
