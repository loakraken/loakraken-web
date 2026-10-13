// Character public summary (api #177, API list #12): a cache-only summary of a
// character for the first HTML of its page — title, description and, for a
// search bot, the page itself — with no official call. Indexing is behind
// CHARACTER_INDEXING (off by default: every character page stays noindex).
// When on, only a character the backend marks indexable is indexed, and a
// bot only ever sees the cache.
//
// B5: a character the operators asked to keep out (processing-stop list), one
// never recorded and one only seen in a roster list must look the same to a
// bot. Every page that is not indexable is therefore the same generic page —
// the requested name and nothing from the response — and only an indexable
// one carries values.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/public-summary.openapi.json";
import type { components } from "../api/public-summary-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { characterNameError, normalizeCharacterName } from "./model";

type Schemas = components["schemas"];
export type PublicSummaryEnvelope = Schemas["ApiResponseCharacterPublicSummaryResponse"];
export type PublicSummary = Schemas["CharacterPublicSummaryResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<PublicSummaryEnvelope>({
    $ref: "#/components/schemas/ApiResponseCharacterPublicSummaryResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isPublicSummaryEnvelope = (value: unknown): value is PublicSummaryEnvelope =>
  validate(value) && value.code === "CHARACTER_PUBLIC_SUMMARY_SUCCESS";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_CACHED"],
  429: ["CLIENT_RATE_LIMITED"],
  503: ["CHARACTER_STORAGE_UNAVAILABLE"],
};

export function requestPublicSummary(
  name: string,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<PublicSummaryEnvelope>> {
  if (characterNameError(name))
    return Promise.resolve({ ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } });
  const url = backendUrl(origin, "/api/v1/characters/public-summary");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isPublicSummaryEnvelope, errorCodes });
}

/** The summary to index, or null: off, missing, failed or not indexable all read the same. */
export function indexableSummary(enabled: boolean, result: BackendResult<PublicSummaryEnvelope> | null) {
  if (!enabled || !result?.ok) return null;
  const summary = result.envelope.data;
  return summary.indexable ? summary : null;
}

const fixed = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

/** "아만 · 블레이드 · 아이템 레벨 1,770 · 전투력 4,000 · 버스트" — only the parts there are. */
export function summaryLine(summary: PublicSummary) {
  return [
    summary.serverName,
    summary.className,
    summary.itemLevel != null ? `아이템 레벨 ${fixed(summary.itemLevel)}` : null,
    summary.combatPower != null ? `전투력 ${fixed(summary.combatPower)}` : null,
    summary.arkPassiveTitle,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Search engine crawlers by user agent (Google, Bing, Naver, Daum, Yandex,
 * DuckDuckGo, Baidu, Apple, and link previews). Only they get the cache page;
 * a person always gets the live page.
 */
const BOT = /bot\b|crawler|spider|slurp|googlebot|bingbot|yeti|daum|daumoa|yandex|duckduckbot|baiduspider|applebot|facebookexternalhit|twitterbot|kakaotalk-scrap/i;
export const isSearchBot = (userAgent: string | null | undefined) => !!userAgent && BOT.test(userAgent);
