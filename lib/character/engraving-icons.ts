// Engraving icons (backend #780): GET /api/v1/markets/engraving-icons →
// { icons: [{ key, icon }] }, built from the cached relic-book market data (no
// official calls). `key` is the engraving name without spaces, since official
// names sometimes space differently ("실드관통"). The list is empty before the
// backend's warmup; an engraving without a match shows no icon. Client-safe:
// the server request lives in engraving-icons-server.ts.

export type EngravingIconsEnvelope = { code: string; data: { icons: { key: string; icon: string }[] } };

export function isEngravingIconsEnvelope(value: unknown): value is EngravingIconsEnvelope {
  if (!value || typeof value !== "object") return false;
  const { code, data } = value as Record<string, unknown>;
  if (typeof code !== "string" || !data || typeof data !== "object") return false;
  const icons = (data as Record<string, unknown>).icons;
  return (
    Array.isArray(icons) &&
    icons.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).key === "string" &&
        typeof (item as Record<string, unknown>).icon === "string",
    )
  );
}

/** The match key: the name without any whitespace. */
export const engravingKey = (name: string | null | undefined) => (name ?? "").replace(/\s+/g, "");

/** name → icon address, by the space-free key. */
export function engravingIconMap(icons: { key: string; icon: string }[] | undefined) {
  return new Map((icons ?? []).map(({ key, icon }) => [engravingKey(key), icon]));
}

/** The same-site route's result: the icons, or none (any failure shows names only). */
export async function fetchEngravingIcons(signal?: AbortSignal) {
  try {
    const response = await fetch("/api/markets/engraving-icons", { signal });
    const result: { ok: boolean; envelope?: unknown } = await response.json();
    return result.ok && isEngravingIconsEnvelope(result.envelope) ? result.envelope.data.icons : [];
  } catch {
    return [];
  }
}
