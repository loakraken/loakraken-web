import "server-only";
import {
  requestCardCollection,
  requestHistory,
  requestSiblings,
  requestViews,
} from "./related";
import { requestCharacter } from "./upstream";
import { requestPopular } from "./popular";

export function getCharacter(name: string, signal?: AbortSignal) {
  return requestCharacter(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getPopular(period: string, limit: number, signal?: AbortSignal) {
  return requestPopular(period, limit, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getCardCollection(name: string, signal?: AbortSignal) {
  return requestCardCollection(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getViews(name: string, signal?: AbortSignal) {
  return requestViews(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getSiblings(name: string, signal?: AbortSignal) {
  return requestSiblings(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getHistory(name: string, server: string, signal?: AbortSignal) {
  return requestHistory(name, server, process.env.LOAKRAKEN_API_ORIGIN, {
    signal,
  });
}
