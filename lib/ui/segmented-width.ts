// The width a segmented row needs on one line, decided from its labels alone so
// the server HTML and the first paint already carry the final layout (no
// measure-then-stack after the fonts, which moved everything below: #346, #1145,
// /market/quote 360·375 CLS 0.15).
//
// The web font is display: optional, so a visit draws labels either in it or in
// the system face it fell back to, and CSS cannot tell which. The advances below
// are the widest of the faces the font stack can draw each kind of glyph in
// (measured at 14px, 2026-11-13): Hangul 1em (Malgun Gothic; our font 0.864,
// Noto Sans KR 0.92), digits 0.63 (ours 0.624), spaces 0.28 (Segoe UI, Noto,
// ours 0.251). A row that fits in the widest face fits in every face; in a
// narrower face it may stack a little earlier than it had to, never later.
const ADVANCE_EM: [RegExp, number][] = [
  [/[ᄀ-ᇿ㄰-㆏가-힯⺀-鿿豈-﫿！-｠]/u, 1],
  [/[0-9]/, 0.63],
  [/[A-Z]/, 0.8],
  [/[a-z]/, 0.68],
  [/\s/, 0.28],
]
// Anything else (punctuation, symbols): the widest seen (·, %, ( ) up to 0.92).
const OTHER_EM = 0.93

/** Label text size: --text-body in app/globals.css (a unit test pins the two together). */
export const SEGMENTED_LABEL_PX = 14
/** Item sides (px-4), the gap between items (gap-1) and the track padding (p-1). */
export const SEGMENTED_ITEM_PAD_PX = 16
const GAP_PX = 4
const TRACK_PAD_PX = 4

/** Upper bound of a label's drawn width, in px. */
export function labelWidth(text: string, fontPx = SEGMENTED_LABEL_PX): number {
  let em = 0
  for (const ch of text) em += ADVANCE_EM.find(([re]) => re.test(ch))?.[1] ?? OTHER_EM
  return em * fontPx
}

/**
 * The narrowest container that holds the row on one line: equal columns, each
 * the widest label plus its sides, the gaps and the track padding. Rounded up
 * to 0.1px. Narrower than this the row is stacked.
 */
export function segmentedRowWidth(labels: string[], itemPadPx = SEGMENTED_ITEM_PAD_PX): number {
  const widest = Math.max(...labels.map((label) => labelWidth(label)))
  const n = labels.length
  const px = n * (widest + 2 * itemPadPx) + GAP_PX * (n - 1) + 2 * TRACK_PAD_PX
  return Math.ceil(px * 10) / 10
}
