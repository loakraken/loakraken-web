// Title equip share (api #314, checklist L13·K11·L44): of the rosters LOAKraken
// has seen, how many had a public character wearing each title. The official
// profile shows only the worn title, so titles owned but not worn are never
// counted — the screen says "장착", never "보유". Off on the backend until the
// screen ships; the screen follows TITLE_STATS (lib/tools/flags.ts).
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/title-equip.openapi.json";
import type { components } from "../api/title-equip-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type TitleEquipEnvelope = Schemas["ApiResponseTitleEquipResponse"];
export type TitleEquip = Schemas["TitleEquipResponse"];
export type EquippedTitle = Schemas["EquippedTitleResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<TitleEquipEnvelope>({
    $ref: "#/components/schemas/ApiResponseTitleEquipResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isTitleEquipEnvelope = (value: unknown): value is TitleEquipEnvelope =>
  validate(value) && value.code === "TITLE_EQUIP_SUCCESS";

export type TitleEquipQuery = { server?: string; activeDays?: 7 | 30 | 90 };

const SERVER = /^[\p{L}\p{N}]+$/u;

/** From the stats screen's own filters: only server and days apply here. */
export function titleEquipQuery(input: { server?: string; activeDays?: number }): TitleEquipQuery {
  const server = input.server?.trim();
  const days = input.activeDays;
  return {
    server: server && server.length <= 16 && SERVER.test(server) ? server : undefined,
    activeDays: days === 7 || days === 30 || days === 90 ? days : undefined,
  };
}

export function titleEquipSearch(query: TitleEquipQuery) {
  const out = new URLSearchParams();
  if (query.server) out.set("server", query.server);
  if (query.activeDays) out.set("activeDays", String(query.activeDays));
  return out;
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestTitleEquip(
  query: TitleEquipQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<TitleEquipEnvelope>> {
  const url = backendUrl(origin, "/api/v1/titles/equipped");
  if (url) for (const [key, value] of titleEquipSearch(query)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isTitleEquipEnvelope, errorCodes });
}

/** "32.26%" of the rosters seen; a share the backend could not give reads "-". */
export const equipShare = (title: EquippedTitle) =>
  title.equippedPercent == null ? "-" : `${title.equippedPercent.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
