// Title equip share (api #314, checklist L13·K11·L44): of the rosters LOAKraken
// has seen, how many had a public character wearing each title. The official
// profile shows only the worn title, so titles owned but not worn are never
// counted — the screen says "장착", never "보유". Off on the backend until the
// screen ships; the screen follows TITLE_STATS (lib/tools/flags.ts).

import type { components } from "../api/title-equip-schema";

type Schemas = components["schemas"];
export type TitleEquipEnvelope = Schemas["ApiResponseTitleEquipResponse"];
export type TitleEquip = Schemas["TitleEquipResponse"];
export type EquippedTitle = Schemas["EquippedTitleResponse"];

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

/** "32.26%" of the rosters seen; a share the backend could not give reads "-". */
export const equipShare = (title: EquippedTitle) =>
  title.equippedPercent == null ? "-" : `${title.equippedPercent.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
