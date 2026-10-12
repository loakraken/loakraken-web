import type { CSSProperties } from "react";

/**
 * Fixed column widths for the ranking tables (A7, web #673). With the browser's
 * automatic layout every new page of rows (a filter, a period, a server) sized
 * the columns again from their text, so the whole table slid sideways after
 * each choice. Here the widths are set once, in em of the table's font: the
 * table takes the wider of the screen and their sum (narrow screens scroll the
 * table box, as before), any extra width is shared in the same proportions, and
 * a longer value ends in an ellipsis instead of widening its column.
 */
export function rankingColumns(widths: readonly number[]) {
  const sum = widths.reduce((total, width) => total + width, 0);
  return {
    tableProps: {
      "data-fixed": "",
      style: { "--ranking-cols": `${sum}em` } as CSSProperties,
    },
    colgroup: (
      <colgroup>
        {widths.map((width, i) => (
          <col key={i} style={{ width: `${width}em` }} />
        ))}
      </colgroup>
    ),
  };
}
