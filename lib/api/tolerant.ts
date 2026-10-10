// Unknown enum values from the backend: the validators accept them (the
// response is otherwise valid) and the screens show that one item as unknown.
import { UNKNOWN_LABEL } from "../tools/contract";

export { tolerantSchemas, UNKNOWN_LABEL } from "../tools/contract";

/**
 * A label for an enum value, or `fallback` when the value is one this build
 * does not know yet (the generated types cannot see those at compile time).
 */
export function labelOf<K extends string>(
  labels: Record<K, string>,
  value: string | null | undefined,
  fallback = UNKNOWN_LABEL,
): string {
  return value != null && Object.hasOwn(labels, value) ? labels[value as K] : fallback;
}
