import "server-only";
import { requestHistory, requestSiblings } from "./related";
import { requestCharacter } from "./upstream";

export function getCharacter(name: string, signal?: AbortSignal) {
  return requestCharacter(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getSiblings(name: string, signal?: AbortSignal) {
  return requestSiblings(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getHistory(name: string, server: string, signal?: AbortSignal) {
  return requestHistory(name, server, process.env.LOAKRAKEN_API_ORIGIN, {
    signal,
  });
}
