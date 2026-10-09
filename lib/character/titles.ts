// Roster titles (backend #123, title-record-v1): every title LOAKraken has seen
// equipped on the same-server roster, in the order it was first seen. Only
// equipped titles are recorded, so this is never the acquisition order.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/titles.openapi.json";
import type { components } from "../api/titles-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";

type Schemas = components["schemas"];
export type TitlesEnvelope = Schemas["ApiResponseRosterTitlesResponse"];
export type RosterTitles = Schemas["RosterTitlesResponse"];
export type RosterTitle = Schemas["RosterTitleResponse"];

const validate = new Ajv2020({ strict: false, validateFormats: false }).compile<TitlesEnvelope>({
  $ref: "#/components/schemas/ApiResponseRosterTitlesResponse",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
});
const isTime = (value: string) => Number.isFinite(Date.parse(value));

export function isTitlesEnvelope(value: unknown): value is TitlesEnvelope {
  return (
    validate(value) &&
    value.code === "CHARACTER_TITLES_SUCCESS" &&
    value.data.titles.every((t) => isTime(t.firstObservedAt) && isTime(t.lastObservedAt))
  );
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  429: ["LOST_ARK_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: [
    "CHARACTER_HISTORY_DISABLED",
    "CHARACTER_HISTORY_UNAVAILABLE",
    "LOST_ARK_NOT_CONFIGURED",
    "CHARACTER_CACHE_UNAVAILABLE",
  ],
  504: ["LOST_ARK_API_TIMEOUT"],
};
const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestTitles(
  name: string,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<TitlesEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/titles");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isTitlesEnvelope, errorCodes });
}

/** First-seen order (ties keep the backend's order). */
export const byObservedOrder = (titles: RosterTitle[]) =>
  [...titles].sort((a, b) => a.observedOrder - b.observedOrder);

const day = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** 2026. 10. 01. → 2026.10.01 (KST). */
export const titleDate = (iso: string) => day.format(new Date(iso)).replace(/\.\s?/g, ".").replace(/\.$/, "");

/**
 * First-seen order folded by KST day (backend #176): titles first seen on the
 * same day came in together (one roster scan), so their order means nothing
 * and they are shown as one "같은 날 확인" group. Uses the backend's
 * firstObservedDate (KST), or the KST date of firstObservedAt if it is malformed.
 */
export function groupByDay(titles: RosterTitle[]) {
  const groups: { day: string; titles: RosterTitle[] }[] = [];
  for (const title of byObservedOrder(titles)) {
    const given = title.firstObservedDate;
    const day = given && /^\d{4}-\d{2}-\d{2}$/.test(given) ? given.replaceAll("-", ".") : titleDate(title.firstObservedAt);
    const last = groups.at(-1);
    if (last && last.day === day) last.titles.push(title);
    else groups.push({ day, titles: [title] });
  }
  return groups;
}
