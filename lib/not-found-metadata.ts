import type { Metadata } from "next";

/**
 * The 404's title and no indexing, for a page that answers 404 itself (a tool
 * hidden by its switch, a note that is not there): its own metadata would
 * otherwise name the hidden feature in the tab (QA v0.3.1 최종 P1).
 */
export const NOT_FOUND_METADATA: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false },
};
