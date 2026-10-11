// Collectible ranking (backend #295/#304, checklist K33): rosters LOAKraken has
// observed, by collectible progress (Σ Point / Σ MaxPoint). Collectibles are
// shared by the roster, so the default unit is the roster (its representative
// character); CHARACTER gives each observed character its roster's value.
// Off on the backend until the screen ships; the screen follows
// COLLECTIBLE_RANKING (lib/tools/flags.ts) the same way as the roster ranking.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/collectible-ranking.openapi.json";
import type { components } from "../api/collectible-ranking-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type CollectibleRankingEnvelope = Schemas["ApiResponseCollectibleRankingResponse"];
export type CollectibleRanking = Schemas["CollectibleRankingResponse"];
export type CollectibleRow = Schemas["CollectibleRankingRowResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<CollectibleRankingEnvelope>({
    $ref: "#/components/schemas/ApiResponseCollectibleRankingResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isCollectibleRankingEnvelope = (value: unknown): value is CollectibleRankingEnvelope =>
  validate(value) && value.code === "COLLECTIBLE_RANKING_SUCCESS";

export const COLLECTIBLE_UNITS = [
  { id: "ROSTER", label: "원정대" },
  { id: "CHARACTER", label: "캐릭터" },
] as const;
export const COLLECTIBLE_DAYS = [7, 30, 90] as const;
export type CollectibleUnit = (typeof COLLECTIBLE_UNITS)[number]["id"];
export type CollectibleDays = (typeof COLLECTIBLE_DAYS)[number];
export type CollectibleQuery = { unit: CollectibleUnit; server?: string; activeDays: CollectibleDays; page: number };

export const COLLECTIBLE_PAGE_SIZE = 50;
export const COLLECTIBLE_MAX_PAGE = 200;

/** From a shared link; unknown values fall back to the defaults (roster, 30 days). */
export function parseCollectibleQuery(input: URLSearchParams): CollectibleQuery {
  const unit = input.get("unit");
  const days = Number(input.get("activeDays") ?? 30);
  const server = input.get("server")?.trim();
  const page = Number(input.get("page") ?? 1);
  return {
    unit: unit === "CHARACTER" ? "CHARACTER" : "ROSTER",
    server: server && server.length <= 16 && /^[\p{L}\p{N}]+$/u.test(server) ? server : undefined,
    activeDays: COLLECTIBLE_DAYS.find((d) => d === days) ?? 30,
    page: Number.isInteger(page) && page >= 1 && page <= COLLECTIBLE_MAX_PAGE ? page : 1,
  };
}

/** The screen's own parameters (type=collectibles kept by the page); defaults left out. */
export function collectibleSearch(query: CollectibleQuery) {
  const out = new URLSearchParams({ type: "collectibles" });
  if (query.unit !== "ROSTER") out.set("unit", query.unit);
  if (query.server) out.set("server", query.server);
  if (query.activeDays !== 30) out.set("activeDays", String(query.activeDays));
  if (query.page > 1) out.set("page", String(query.page));
  return out;
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestCollectibleRanking(
  query: CollectibleQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<CollectibleRankingEnvelope>> {
  const url = backendUrl(origin, "/api/v1/rankings/collectibles");
  if (url) {
    url.searchParams.set("unit", query.unit);
    if (query.server) url.searchParams.set("server", query.server);
    url.searchParams.set("activeDays", String(query.activeDays));
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("size", String(COLLECTIBLE_PAGE_SIZE));
  }
  return requestBackend(url, { ...options, isValid: isCollectibleRankingEnvelope, errorCodes });
}

/** 73.85% style, two decimals as the backend sends them. */
export const progressText = (value: number) =>
  `${value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
