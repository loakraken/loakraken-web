/**
 * The ranking podium's cards: the first three ranked rows in the table's own
 * order (QA v0.3.8: tied ranks such as 1, 1, 3 have no rank 2, and finding
 * ranks 1, 2 and 3 left the box empty). Each keeps its real rank, so a tie
 * reads as a tie; its slot (centre, left, right) only places it. Unranked
 * rows ('-') are not on the podium.
 */
export function podiumTop<T extends { rank: number | null | undefined }>(entries: readonly T[]) {
  return entries.filter((entry) => entry.rank != null && entry.rank >= 1).slice(0, 3);
}
