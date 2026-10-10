// Recent searches (per browser), shown on the home page like LOAWA's
// "최근 검색" card: name, item level, server and class of each character that
// was searched successfully. Users can stop saving and clear the list.
export type RecentCharacter = {
  name: string;
  server: string | null;
  className: string | null;
  itemLevel: number | null;
  /** Added later; older stored rows have none. */
  combatPower?: number | null;
  at: number;
};

const RECENT = "loakraken:recent";
const RECENT_OFF = "loakraken:recent-off";
export const RECENT_EVENT = "loakraken:recent";
export const RECENT_LIMIT = 10;

/** Newest first, one entry per name, capped. */
export function addRecent(list: RecentCharacter[], entry: RecentCharacter) {
  return [entry, ...list.filter((item) => item.name !== entry.name)].slice(0, RECENT_LIMIT);
}

const isEntry = (value: unknown): value is RecentCharacter => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    v.name.length > 0 &&
    (v.server === null || typeof v.server === "string") &&
    (v.className === null || typeof v.className === "string") &&
    (v.itemLevel === null || typeof v.itemLevel === "number") &&
    (v.combatPower === undefined || v.combatPower === null || typeof v.combatPower === "number") &&
    typeof v.at === "number"
  );
};

/** Parses stored JSON defensively: anything malformed is dropped. */
export function parseRecent(raw: string | null): RecentCharacter[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter(isEntry).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    /* Storage blocked: the list simply does not persist. */
  }
};

/** Raw snapshot for useSyncExternalStore (a string, so it compares by value). */
export const recentSnapshot = () => `${read(RECENT_OFF) ?? ""}|${read(RECENT) ?? "[]"}`;
export function readSnapshot(snapshot: string) {
  const at = snapshot.indexOf("|");
  return { saving: snapshot.slice(0, at) !== "1", list: parseRecent(snapshot.slice(at + 1)) };
}
export const subscribeRecent = (callback: () => void) => {
  window.addEventListener(RECENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(RECENT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

export function recordRecent(entry: Omit<RecentCharacter, "at">) {
  if (read(RECENT_OFF) === "1") return;
  write(RECENT, JSON.stringify(addRecent(parseRecent(read(RECENT)), { ...entry, at: Date.now() })));
}
export function removeRecent(name: string) {
  write(RECENT, JSON.stringify(parseRecent(read(RECENT)).filter((item) => item.name !== name)));
}
export const clearRecent = () => write(RECENT, null);
/** Turning saving off also forgets what was saved. */
export function setRecentSaving(saving: boolean) {
  if (saving) write(RECENT_OFF, null);
  else {
    write(RECENT_OFF, "1");
    write(RECENT, null);
  }
}
