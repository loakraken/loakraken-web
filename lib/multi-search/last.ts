// The last compared list, so coming back from the menu does not mean typing
// the raid again. It is kept while any tab of the site is open (other pages,
// another site and back, reloads, a second tab) and forgotten when the last
// of our tabs closes (user 11-08; replaces "per browser", 10-16): see
// share.ts. Only names the user typed or opened; "모두 지우기" forgets it.
import { namesFromParam } from "./model";
import { LAST_KEY, askOpenTabs, readStored, storeAndShare } from "./share";

// Lists saved per browser before 11-08 stay in localStorage forever: removed
// once (first read in this page), so an old list never comes back.
let oldRemoved = false;
function removeOldSaved() {
  if (oldRemoved) return;
  oldRemoved = true;
  try {
    localStorage.removeItem(LAST_KEY);
  } catch {
    /* Storage blocked: there is nothing saved to remove. */
  }
}

/** This tab's list (comma-joined, like the address); anything invalid is dropped. */
export function readLastNames() {
  removeOldSaved();
  return namesFromParam(readStored());
}

/** This tab had none: the list of another open tab of the site, if any. */
export async function askLastNames(wait?: number) {
  return namesFromParam(await askOpenTabs(wait));
}

export function saveLastNames(names: string[]) {
  storeAndShare(names.join(","));
}
