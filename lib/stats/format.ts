// Number and condition wording for statistics, apart from model.ts: model
// bundles the stats contract (for validating responses), which the home cards
// and the character page's help popovers do not need to download.
import type { components } from "../api/stats-schema";

type StatsMeta = components["schemas"]["StatsMetaResponse"];

export const count = (n: number) => n.toLocaleString("ko-KR");
export const fixed = (n: number | null | undefined, digits = 2) =>
  n == null ? "-" : n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const whole = (n: number | null | undefined) =>
  n == null ? "-" : n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
export const percent = (n: number | null | undefined) =>
  n == null ? "-" : `${n.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;

/**
 * A population share, always one decimal so a column lines up ("8.7%",
 * "5.0%"); a small but non-zero share is "<0.1%", never a false "0%".
 */
export function share(n: number | null | undefined) {
  if (n == null) return "-";
  if (n > 0 && n < 0.05) return "<0.1%";
  return `${n.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** The filters alone ("최근 30일 안에 확인 · 아이템 레벨 1,640 이상"), for under the basis line. */
export function sampleConditions(meta: StatsMeta) {
  return conditionsText(meta.conditions);
}

/** The filters in words, from any stats or rank response conditions. */
export function conditionsText(c: StatsMeta["conditions"]) {
  return conditionParts(c, "확인").join(" · ");
}

function conditionParts(c: StatsMeta["conditions"], seen: string) {
  const parts = [`최근 ${c.activeDays}일 안에 ${seen}`];
  if (c.itemLevelMin > 0) parts.push(`아이템 레벨 ${count(c.itemLevelMin)} 이상`);
  if (c.itemLevelMax != null) parts.push(`${count(c.itemLevelMax)} 이하`);
  if (c.server) parts.push(c.server);
  if (c.role) parts.push(c.role === "SUPPORT" ? "서포터" : "딜러");
  if (c.representativeOnly) parts.push("원정대 대표 캐릭터만");
  return parts;
}

/** The sample in words: who is counted, and that it is not the whole game. */
export function sampleText(meta: StatsMeta, unit: "character" | "roster" | "guild" = "character") {
  const seen = { character: "LOAKraken이 확인한 캐릭터", roster: "LOAKraken이 확인한 원정대", guild: "LOAKraken이 확인한 캐릭터로 묶은 길드" }[unit];
  const counted = { character: "명", roster: "개 원정대", guild: "개 길드" }[unit];
  return `${conditionParts(meta.conditions, seen).join(" · ")} ${count(meta.population)}${counted} 기준`;
}
