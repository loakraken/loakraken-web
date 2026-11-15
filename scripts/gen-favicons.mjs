// Writes the raster favicons from the logo mark (components/ui/logo.tsx), so search results show our mark instead
// of a blank globe: Google wants a crawlable square icon that is a multiple of 48px, and its fetcher often falls
// back to /favicon.ico (404 until now). app/icon.svg stays the browsers' icon.
//   app/favicon.ico  16 / 32 / 48 (32-bit BMP entries: every reader takes them)
//   app/icon1.png    192 × 192
// Both draw the mark in the light ink on a solid light tile (no alpha), the apple-icon's look, so they read on light
// and dark result pages alike. 48 and 192 keep the apple-icon's margin; 16 and 32 fill the tile so the mark stays
// legible in a tab. Like LogoMark, a mark drawn at 24px or less drops its suckers.
//   node scripts/gen-favicons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const TILE = "#ffffff";
const INK = "#1d1d1f";
// apple-icon.png (180): the 64-unit mark box is 132px wide, 24px in from each edge.
const MARGIN = 24 / 180;

const logo = readFileSync(root("components/ui/logo.tsx"), "utf8");
const constant = (name) => {
  const found = logo.match(new RegExp(`const ${name} = (\\[.*?\\]) as const`));
  if (!found) throw new Error(`components/ui/logo.tsx has no ${name} constant any more`);
  return JSON.parse(found[1]);
};
const FULL = constant("FULL");
const SIMPLE = constant("SIMPLE");
const SUCKERS = constant("SUCKERS");

/** The tile with the mark, as an SVG `size` px square; `margin` is the share of the tile left around the mark box. */
function svg(size, margin) {
  const box = size * (1 - 2 * margin);
  const scale = box / 64;
  const at = size * margin;
  const mark =
    box <= 24
      ? SIMPLE.map((d) => `<path d="${d}"/>`).join("")
      : `<defs><mask id="m"><rect width="64" height="64" fill="#fff"/>${SUCKERS.map(
          ([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#000"/>`,
        ).join("")}</mask></defs><g mask="url(#m)">${FULL.map((d) => `<path d="${d}"/>`).join("")}</g>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" fill="${TILE}"/>` +
      `<g transform="translate(${at} ${at}) scale(${scale})" fill="${INK}">${mark}</g></svg>`,
  );
}

const pixels = (size, margin) =>
  sharp(svg(size, margin)).flatten({ background: TILE }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

/** One ICO entry as a 32-bit BMP (BITMAPINFOHEADER, rows bottom-up in BGRA, then an all-clear AND mask). */
async function bmp(size, margin) {
  const { data, info } = await pixels(size, margin);
  if (info.width !== size || info.channels !== 4) throw new Error(`unexpected raster ${info.width} × ${info.channels}`);
  const maskRow = Math.ceil(size / 32) * 4;
  const out = Buffer.alloc(40 + size * size * 4 + maskRow * size);
  out.writeUInt32LE(40, 0);
  out.writeInt32LE(size, 4);
  out.writeInt32LE(size * 2, 8); // colour rows + mask rows
  out.writeUInt16LE(1, 12);
  out.writeUInt16LE(32, 14);
  out.writeUInt32LE(size * size * 4 + maskRow * size, 20);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4;
      const to = 40 + ((size - 1 - y) * size + x) * 4;
      out[to] = data[from + 2];
      out[to + 1] = data[from + 1];
      out[to + 2] = data[from];
      out[to + 3] = 255;
    }
  return out;
}

async function ico(entries) {
  const images = await Promise.all(entries.map(([size, margin]) => bmp(size, margin)));
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach((image, i) => {
    const at = 6 + 16 * i;
    const size = entries[i][0];
    head[at] = size;
    head[at + 1] = size;
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(image.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += image.length;
  });
  return Buffer.concat([head, ...images]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(root("app/favicon.ico"), await ico([[16, 0], [32, 0], [48, MARGIN]]));
  // No alpha channel: the tile is opaque by construction.
  writeFileSync(
    root("app/icon1.png"),
    await sharp(svg(192, MARGIN)).flatten({ background: TILE }).removeAlpha().png({ compressionLevel: 9 }).toBuffer(),
  );
}
