import "server-only";
import { cache } from "react";
import { requestPublicSummary } from "./public-summary";
import { requestItemTooltips } from "./item-tooltips";
import {
  requestCardCollection,
  requestCardRefresh,
  requestHistory,
  requestSiblings,
  requestViews,
} from "./related";
import { requestCharacter } from "./upstream";
import { requestPopular } from "./popular";
import { requestSuggest } from "./suggest";
import { requestRank } from "./rank";
import { requestArmoryPage } from "./armory-page";
import { requestCollectibleOwnership, requestCollectibleStanding } from "./collectible-standing";
import { requestReceipt } from "./receipt";
import { requestTitles } from "./titles";

export function getCharacter(name: string, signal?: AbortSignal) {
  return requestCharacter(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getPopular(period: string, limit: number, signal?: AbortSignal) {
  return requestPopular(period, limit, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getSuggest(q: string, signal?: AbortSignal) {
  return requestSuggest(q, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getCardCollection(name: string, signal?: AbortSignal) {
  return requestCardCollection(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getRank(name: string, signal?: AbortSignal) {
  return requestRank(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getReceipt(name: string, assumeBook: boolean, signal?: AbortSignal) {
  return requestReceipt(name, assumeBook, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getItemTooltips(name: string, signal?: AbortSignal) {
  return requestItemTooltips(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getTitles(name: string, signal?: AbortSignal) {
  return requestTitles(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function refreshCardCollection(name: string, signal?: AbortSignal) {
  return requestCardRefresh(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
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

export function getCollectibleStanding(name: string, signal?: AbortSignal) {
  return requestCollectibleStanding(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getCollectibleOwnership(type: string, signal?: AbortSignal) {
  return requestCollectibleOwnership(type, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getArmoryPage(name: string, signal?: AbortSignal) {
  return requestArmoryPage(name, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

/** Cache-only summary (no official call); one request per render (metadata + page). */
export const getPublicSummary = cache((name: string) =>
  requestPublicSummary(name, process.env.LOAKRAKEN_API_ORIGIN, { timeoutMs: 1_500 }),
);
