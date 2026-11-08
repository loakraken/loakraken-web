// The /about intro's cursors: colours only, a cursor is its index (no names).

/** Cursor arrow colours: each >= 3:1 on the light and the dark page. */
export const CURSOR_COLORS = [
  "#c52020", "#1d66af", "#137634", "#7b6114",
  "#7e3adf", "#13725a", "#9a4f19", "#3a7213",
  "#156d7f", "#bd1f6e", "#4754e1", "#ab1eb8",
] as const;

/** Which cursors (indexes into CURSOR_COLORS) build which section: at most four each. */
export const CREW: Record<string, readonly number[]> = {
  intro: [0, 1, 9, 10],
  preview: [1, 2, 3, 4],
  evidence: [2, 5, 6, 11],
  roadmap: [0, 7, 8, 9],
  closing: [4, 5, 10, 11],
};
