import type { ValidateFunction } from "ajv";

/**
 * Compile an Ajv validator on its first use instead of at module load. Client
 * components import these modules for labels and helpers but never validate
 * (the proxies do, on the server); compiling every contract at load cost about
 * half a second of main thread on a slow phone right after hydration.
 */
export function lazyValidator<T>(compile: () => ValidateFunction<T>): (value: unknown) => value is T {
  let validate: ValidateFunction<T> | undefined;
  return (value: unknown): value is T => (validate ??= compile())(value);
}
