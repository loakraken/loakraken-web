// The official armory render is a JPG with a near-uniform dark backdrop baked in.
// To place it on a light surface, remove only the backdrop that is connected to
// the image border (dark clothing inside the silhouette stays opaque) and
// "un-blend" soft glow pixels so effects keep their colour as translucency.

export type Rgb = readonly [number, number, number];

const NEAR = 10; // channel distance treated as pure backdrop
const STOP = 56; // distance where the subject begins; flood fill stops here
// Skill effects are light added over the black backdrop. Coloured, smooth
// pixels are treated as emitted light (translucent, hue at full brightness)
// instead of a dark matte, so smoke reads as light on a pale surface. Bright
// effect cores and textured or desaturated detail keep the original pixel.
const GLOW_MAX = 170; // emission at this brightness is fully opaque
const GLOW_FADE = [95, 150] as const; // brightness where cores take over
const GLOW_CHROMA_HI = 0.55; // (max - min) / max where light is clearly coloured

const smooth = (from: number, to: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** 0 = keep the original pixel, 1 = colour that behaves like emitted light. */
export function glowWeight(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  if (max === 0) return 0;
  const chroma = (max - Math.min(r, g, b)) / max;
  // Dim fringes count as light at a lower chroma than mid-bright pixels.
  const low = 0.15 + 0.17 * smooth(70, 120, max);
  return (
    smooth(low, GLOW_CHROMA_HI, chroma) *
    (1 - smooth(GLOW_FADE[0], GLOW_FADE[1], max))
  );
}

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
  const source = data.slice();
  const lum = (p: number) =>
    source[p * 4] * 0.3 + source[p * 4 + 1] * 0.59 + source[p * 4 + 2] * 0.11;
  // Per-pixel light weight, kept for the speck clean-up pass below.
  const lightOf = new Float32Array(total);
  // Glow is a smooth gradient; metal, cloth and skin carry texture. The largest
  // brightness step to a neighbour keeps textured surfaces opaque.
  const smoothness = (p: number) => {
    const x = p % width;
    const here = lum(p);
    let step = 0;
    if (x > 0) step = Math.max(step, Math.abs(here - lum(p - 1)));
    if (x < width - 1) step = Math.max(step, Math.abs(here - lum(p + 1)));
    if (p >= width) step = Math.max(step, Math.abs(here - lum(p - width)));
    if (p < total - width)
      step = Math.max(step, Math.abs(here - lum(p + width)));
    return 1 - smooth(4, 12, step);
  };
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
    const sr = source[i];
    const sg = source[i + 1];
    const sb = source[i + 2];
    const distance = Math.max(
      Math.abs(sr - br),
      Math.abs(sg - bg),
      Math.abs(sb - bb),
    );
    // How much this pixel behaves like emitted light (coloured and smooth).
    const light = glowWeight(sr, sg, sb) * smoothness(p);
    lightOf[p] = light;
    if (distance >= STOP && light < 0.02) continue;

    // Matte model: the original colour composited over the backdrop.
    const matteAlpha =
      distance >= STOP
        ? 1
        : distance <= NEAR
          ? 0
          : (distance - NEAR) / (STOP - NEAR);
    const unblend = (value: number, back: number) =>
      matteAlpha === 0
        ? 0
        : Math.min(
            255,
            Math.max(0, (value - back * (1 - matteAlpha)) / matteAlpha),
          );
    // Emission model: light added over the backdrop, hue at full brightness.
    const er = Math.max(0, sr - br);
    const eg = Math.max(0, sg - bg);
    const eb = Math.max(0, sb - bb);
    const peak = Math.max(er, eg, eb, 1);
    const glowAlpha = Math.min(1, peak / GLOW_MAX);

    const alpha = matteAlpha * (1 - light) + glowAlpha * light;
    if (alpha < 0.004) {
      data[i + 3] = 0;
    } else {
      const channel = (value: number, back: number, emitted: number) =>
        Math.min(
          255,
          Math.round(
            (unblend(value, back) * matteAlpha * (1 - light) +
              (emitted / peak) * 255 * glowAlpha * light) /
              alpha,
          ),
        );
      data[i] = channel(sr, br, er);
      data[i + 1] = channel(sg, bg, eg);
      data[i + 2] = channel(sb, bb, eb);
      data[i + 3] = Math.round(alpha * 255);
    }
    removed++;
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < total - width) stack.push(p + width);
  }

  // Isolated textured pixels inside translucent smoke stay opaque and read as
  // specks; average the alpha over the 3x3 neighbourhood wherever light was
  // involved (subject pixels with no light weight keep their alpha).
  const alphas = new Uint8ClampedArray(total);
  for (let p = 0; p < total; p++) alphas[p] = data[p * 4 + 3];
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      let near = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) near = Math.max(near, lightOf[p + dy * width + dx]);
      if (near < 0.05) continue;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) sum += alphas[p + dy * width + dx];
      data[p * 4 + 3] = Math.round(sum / 9);
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

/** Brightest channel the banner band may take (RGB 0-255). */
export const BANNER_BACKDROP_MAX = 48;

/**
 * Banner band colour from the render's backdrop: channels scaled down (hue
 * kept) so the brightest is at most BANNER_BACKDROP_MAX. The banner's light
 * text (muted #a1a1a6, dealer #ff8a80) then keeps 4.5:1 on any accepted
 * backdrop (up to 70); the render's own edges fade into the band.
 */
export function bannerBackdrop(rgb: Rgb): Rgb {
  const max = Math.max(...rgb);
  const k = max > BANNER_BACKDROP_MAX ? BANNER_BACKDROP_MAX / max : 1;
  const [r, g, b] = rgb.map((v) => Math.round(v * k));
  return [r, g, b];
}

/**
 * Normalises the subject's dominant colour into a clean glow tint: keeps the
 * hue, lifts saturation and pins lightness so a muddy average still reads as
 * the effect colour. Near-grey inputs stay neutral (no invented hue).
 */
export function glowTint(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const s = saturation < 0.12 ? saturation : Math.max(0.72, Math.min(0.9, saturation));
  const l = 0.55;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [rr, gg, bb] =
    hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];
  return [rr, gg, bb].map((v) => Math.round((v + m) * 255)) as unknown as Rgb;
}
