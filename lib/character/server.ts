import "server-only";
import { requestCharacter } from "./upstream";

export function getCharacter(name: string, signal?: AbortSignal) {
  return requestCharacter(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}
