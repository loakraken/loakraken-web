import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { inflateSync } from "node:zlib";

// The raster favicons scripts/gen-favicons.mjs writes from the logo mark. Search results showed a blank globe:
// /favicon.ico was 404 and the only icon was an SVG with no background. These pin what the fetchers need: the
// sizes, an opaque solid tile (readable on light and dark result pages), and the mark on it.

const TILE = [255, 255, 255];
const app = (file: string) => new URL(`../app/${file}`, import.meta.url);

type Raster = { size: number; rgba: (x: number, y: number) => number[] };

/** Every pixel opaque, the four corners the tile, and a fair share of dark (mark) pixels. */
function assertTileWithMark({ size, rgba }: Raster, label: string) {
  let dark = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = rgba(x, y);
      assert.equal(a, 255, `${label}: (${x}, ${y}) is not opaque`);
      if (r + g + b < 3 * 96) dark++;
    }
  for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]])
    assert.deepEqual(rgba(x, y).slice(0, 3), TILE, `${label}: corner (${x}, ${y}) is not the tile`);
  const share = dark / (size * size);
  assert.ok(share > 0.08 && share < 0.5, `${label}: the mark covers ${(share * 100).toFixed(1)}% of the tile`);
}

test("favicon.ico: 16 / 32 / 48 entries, 32-bit BMP, an opaque tile with the mark", () => {
  const ico = readFileSync(app("favicon.ico"));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1, "type 1 = icon");
  const count = ico.readUInt16LE(4);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const entry = 6 + 16 * i;
    const size = ico[entry] || 256;
    assert.equal(ico[entry + 1] || 256, size, "square");
    assert.equal(ico.readUInt16LE(entry + 6), 32, "32 bits per pixel");
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset + length <= ico.length, `entry ${size} runs past the file`);
    const image = ico.subarray(offset, offset + length);
    assert.equal(image.readUInt32LE(0), 40, `entry ${size}: BITMAPINFOHEADER`);
    assert.equal(image.readInt32LE(4), size);
    assert.equal(image.readInt32LE(8), size * 2, `entry ${size}: colour rows + mask rows`);
    assert.equal(image.readUInt16LE(14), 32);
    assert.equal(image.readUInt32LE(16), 0, `entry ${size}: uncompressed`);
    assert.ok(length >= 40 + size * size * 4 + Math.ceil(size / 32) * 4 * size, `entry ${size}: short`);
    const rgba = (x: number, y: number) => {
      const at = 40 + ((size - 1 - y) * size + x) * 4; // rows bottom-up, BGRA
      return [image[at + 2], image[at + 1], image[at], image[at + 3]];
    };
    assertTileWithMark({ size, rgba }, `favicon.ico ${size}`);
    sizes.push(size);
  }
  assert.deepEqual(sizes, [16, 32, 48]);
});

/** A non-interlaced 8-bit RGB / RGBA PNG, decoded (the five scanline filters undone). */
function readPng(file: URL) {
  const png = readFileSync(file);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "PNG signature");
  let width = 0;
  let height = 0;
  let colourType = -1;
  const idat: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      assert.equal(body[8], 8, "8 bits per channel");
      colourType = body[9];
      assert.equal(body[12], 0, "not interlaced");
    }
    if (type === "IDAT") idat.push(body);
    at += 12 + length;
  }
  const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0;
  assert.ok(channels, `colour type ${colourType} is not RGB / RGBA`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const value = raw[y * (stride + 1) + 1 + i];
      const left = i >= channels ? out[y * stride + i - channels] : 0;
      const up = y ? out[(y - 1) * stride + i] : 0;
      const upLeft = y && i >= channels ? out[(y - 1) * stride + i - channels] : 0;
      const p = left + up - upLeft;
      const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      const predict = [0, left, up, (left + up) >> 1, paeth][filter];
      assert.ok(predict !== undefined, `row ${y}: filter ${filter}`);
      out[y * stride + i] = (value + predict) & 255;
    }
  }
  const rgba = (x: number, y: number) => {
    const at = y * stride + x * channels;
    return [out[at], out[at + 1], out[at + 2], channels === 4 ? out[at + 3] : 255];
  };
  return { width, height, colourType, rgba };
}

test("icon1.png: 192 × 192 (a multiple of 48), no alpha channel, an opaque tile with the mark", () => {
  const { width, height, colourType, rgba } = readPng(app("icon1.png"));
  assert.deepEqual([width, height], [192, 192]);
  assert.equal(colourType, 2, "RGB with no alpha: the tile is opaque everywhere");
  assertTileWithMark({ size: 192, rgba }, "icon1.png");
});

test("icon.svg stays for browsers; the rasters sit beside it in app/", () => {
  assert.ok(existsSync(app("icon.svg")));
  assert.ok(existsSync(app("apple-icon.png")));
  // public/favicon.ico would shadow the app one (and Next refuses the conflict).
  assert.ok(!existsSync(new URL("../public/favicon.ico", import.meta.url)));
});
