import { toResponse } from "@/lib/api/respond";
import { parseEfficiencyQuery, type EfficiencyKind } from "@/lib/stats/rankings";
import { getEfficiencyRanking } from "@/lib/stats/server";

const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

/** 팔찌·젬 효율 랭킹: ?type=bracelets|gems plus the ranking filters. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("type");
  if (kind !== "bracelets" && kind !== "gems") return toResponse(invalid);
  return toResponse(await getEfficiencyRanking(kind satisfies EfficiencyKind, parseEfficiencyQuery(params), request.signal));
}

