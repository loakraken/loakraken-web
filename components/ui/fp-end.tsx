// The end mark of a [data-fp-whole] group (app/globals.css): put it last in the
// group. Until the first HTML has brought it, the group is not drawn, so its
// parts arriving one by one move nothing. Never seen or read.
export function FpEnd() {
  return <span data-fp-end="" hidden />
}
