// The official armory render is a JPG with a near-uniform dark backdrop baked in.
// To place it on a light surface, remove only the backdrop that is connected to
// the image border (dark clothing inside the silhouette stays opaque) and
// "un-blend" soft glow pixels so effects keep their colour as translucency.

export type Rgb = readonly [number, number, number];

const NEAR = 10; // channel distance treated as pure backdrop
const STOP = 56; // distance where the subject begins; flood fill stops here

function sampleBackdrop(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb {
  const patch = Math.max(
    4,
    Math.min(12, Math.floor(Math.min(width, height) / 20)),
  );
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [ox, oy] of [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ])
    for (let y = oy; y < oy + patch; y++)
      for (let x = ox; x < ox + patch; x++) {
        const i = (y * width + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
  return [r / n, g / n, b / n];
}

/**
 * Mutates RGBA pixels in place. Returns the backdrop colour and the dominant
 * lit colour of the subject (for an ambient glow), or null when the image does
 * not look like a dark-backdrop render (then callers should keep the original).
 */
export function cutoutPortrait(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { backdrop: Rgb; ambient: Rgb | null; removed: number } | null {
  const backdrop = sampleBackdrop(data, width, height);
  const [br, bg, bb] = backdrop;
  // Only dark, low-saturation backdrops are supported.
  if (
    Math.max(br, bg, bb) > 70 ||
    Math.max(br, bg, bb) - Math.min(br, bg, bb) > 30
  )
    return null;

  const total = width * height;
  const seen = new Uint8Array(total);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);

  let removed = 0;
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    const distance = Math.max(
      Math.abs(data[i] - br),
      Math.abs(data[i + 1] - bg),
      Math.abs(data[i + 2] - bb),
    );
    if (distance >= STOP) continue;
    const alpha = distance <= NEAR ? 0 : (distance - NEAR) / (STOP - NEAR);
    if (alpha === 0) {
      data[i + 3] = 0;
    } else {
      // Recover the foreground colour that was composited over the backdrop.
      data[i] = Math.min(
        255,
        Math.max(0, (data[i] - br * (1 - alpha)) / alpha),
      );
      data[i + 1] = Math.min(
        255,
        Math.max(0, (data[i + 1] - bg * (1 - alpha)) / alpha),
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, (data[i + 2] - bb * (1 - alpha)) / alpha),
      );
      data[i + 3] = Math.round(alpha * 255);
    }
    removed++;
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < total - width) stack.push(p + width);
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 16) {
    const a = data[i + 3] / 255;
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    // Favour bright, saturated pixels (effects, armour) over neutral ones.
    const w = a * ((max - min) / 255) * (max / 255) ** 2;
    r += data[i] * w;
    g += data[i + 1] * w;
    b += data[i + 2] * w;
    weight += w;
  }
  const ambient: Rgb | null =
    weight > 0.5
      ? [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight)]
      : null;
  return { backdrop, ambient, removed };
}
