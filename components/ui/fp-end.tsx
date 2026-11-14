// The end mark of a [data-fp-whole] group (app/globals.css): put it last in the
// group. Until the first HTML has brought it, the group is not drawn, so its
// parts arriving one by one move nothing. Never seen or read.
// A <template>, not a <span>: the browser never draws one, and it is not caught
// by a group's own child rules or by a spec's `> span` (a span mark showed up as
// an empty, cut-off count in the 각인 card, character sweep 2).
export function FpEnd() {
  return <template data-fp-end="" />
}
