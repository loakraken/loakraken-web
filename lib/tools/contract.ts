// Runtime validation helpers shared by the tool screens.

type Schema = { [key: string]: unknown };

/**
 * A copy of an OpenAPI `components.schemas` map with every `enum` removed from
 * the response schemas (names not ending in "Request"). A value the backend
 * adds later (e.g. a new source axis) is then no reason to reject the whole
 * response and blank the screen; the screen shows that one item as unknown.
 * Types, required fields and request enums are still checked.
 */
export function tolerantSchemas<T extends Record<string, unknown>>(schemas: T): T {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;
    const out: Schema = {};
    for (const [key, child] of Object.entries(value))
      if (key !== "enum") out[key] = strip(child);
    return out;
  };
  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      name.endsWith("Request") ? structuredClone(schema) : strip(schema),
    ]),
  ) as T;
}

export const UNKNOWN_LABEL = "알 수 없음";
