// The last compared list (per browser), so coming back from the menu does
// not mean typing the raid again (user 10-16). Only names the user typed or
// opened; "모두 지우기" forgets it.
import { namesFromParam } from "./model";

const LAST = "loakraken:multi-search";

/** Names as stored (comma-joined, like the address); anything invalid is dropped. */
export function readLastNames() {
  try {
    return namesFromParam(localStorage.getItem(LAST));
  } catch {
    return [];
  }
}

export function saveLastNames(names: string[]) {
  try {
    if (names.length) localStorage.setItem(LAST, names.join(","));
    else localStorage.removeItem(LAST);
  } catch {
    /* Storage blocked: the list simply is not remembered. */
  }
}
