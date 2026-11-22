"use client";

// M41 (PM 총괄 11-22 13:40): per part, the same target 숨결 없이 vs 숨결 최대, each valued at market with 누골 apart,
// and one breath's value against its price (lib/refining/breath.ts). Mounted under the result (프론트2 holds the
// target card, 11-22 boundary). Each row keeps its lines from the first frame ('—' until the plans and prices
// come), so nothing under it moves when they arrive (A7).
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { postMaterialPrices } from "@/lib/market/client";
import { MAX_PRICE_NAMES, type PriceBasis } from "@/lib/market/model";
import { postRefiningPlan } from "@/lib/refining/client";
import { breathCompare, leftOutLabel, priceNames, type BreathCompare } from "@/lib/refining/breath";
import {
  formatCount,
  requestKey,
  type Mode,
  type PartPlan,
  type PlanRequest,
} from "@/lib/refining/model";
import styles from "./refining-breath.module.css";

export type BreathRequest = { part: PartPlan["part"]; request: PlanRequest };

const DASH = "—";
/** The result's price refresh (refining-plan.tsx PRICE_REFRESH_MS). */
const PRICE_REFRESH_MS = 60_000;
const NBSP = "\u00a0";
const gold = (value: number | null | undefined) => (value == null ? DASH : `${formatCount(value)}${NBSP}G`);

/** A side's total; '이상' when it leaves out something the other side does not (its real total is higher). */
const total = (side: { total: number; incomplete: boolean } | undefined) =>
  side ? `${gold(side.total)}${side.incomplete ? " 이상" : ""}` : DASH;

function verdictText(c: BreathCompare | null) {
  if (!c) return "숨결 1개 가치를 계산하고 있어요…";
  // PM-프론트 #1932: unpriced materials the two ways use in different amounts — neither the totals nor the saving hold.
  if (c.uneven.length > 0) return "시세가 없는 재료를 두 방식이 다르게 써서 비교하지 않았어요.";
  if (c.breathValue == null) return "숨결을 쓰지 않는 단계예요.";
  const value = `숨결 1개 가치 ${gold(c.breathValue)}`;
  if (c.verdict === "BUY") return `${value} · 시세 ${gold(c.breathPrice)} → 사서 써도 이득이에요.`;
  if (c.verdict === "SKIP") return `${value} · 시세 ${gold(c.breathPrice)} → 숨결 없이가 유리해요.`;
  return `${value} · 숨결 시세가 없어 판단하지 않았어요.`;
}

export function RefiningBreathCompare({
  requests,
  mode,
  basis,
  extraNames = [],
}: {
  requests: readonly BreathRequest[];
  mode: Mode;
  basis: PriceBasis;
  /** The 상급 재련 materials the result prices too (X3 part 2): the same list keeps one price query. */
  extraNames?: readonly string[];
}) {
  // Both ways for every part; the one the page already asked for comes from the same cache entry.
  const variants = requests.flatMap(({ request }) => [
    { ...request, useBreath: false },
    { ...request, useBreath: true },
  ]);
  const plans = useQueries({
    queries: variants.map((request) => ({
      queryKey: ["refining", requestKey(request)],
      queryFn: ({ signal }: { signal: AbortSignal }) => postRefiningPlan(request, signal),
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });
  const loaded = plans.every((q) => q.data);
  const failed = plans.some((q) => q.isError);
  // The page's own plans (the way the user picked), in its order: the same list the result asks prices for.
  const own: PartPlan[] = loaded
    ? requests.map(({ part, request }, i) => ({ part, plan: plans[i * 2 + (request.useBreath ? 1 : 0)].data!.data }))
    : [];
  const names = loaded ? priceNames(own, mode, extraNames) : [];
  // The result's own price query (useRefiningCost): same list (priceNames), same key and body, so one request a minute
  // serves both (PM-프론트 #1932, performance first). This side only reads it: no timer of its own (two timers could
  // fetch twice a minute); the result's minute refresh brings the new prices here too. A new basis or mode keeps the
  // last rows, dimmed, until the new prices come (no '—' flash).
  const tooMany = names.length > MAX_PRICE_NAMES;
  const prices = useQuery({
    queryKey: ["material-prices", basis, [...names].sort().join("|")],
    queryFn: ({ signal }) => postMaterialPrices({ priceBasis: basis, names }, signal),
    enabled: names.length > 0 && !tooMany,
    staleTime: PRICE_REFRESH_MS,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const priceList = prices.data?.data.items ?? null;
  const noPrices = !priceList && (prices.isError || tooMany);

  return (
    <section className={styles.compare} aria-labelledby="breath-compare-heading">
      <h3 id="breath-compare-heading" className={styles.title}>
        숨결 쓰기 비교
      </h3>
      <p className={styles.caption}>
        부위마다 같은 목표를 숨결 없이 · 숨결 최대로 했을 때예요. 가진 재료도 시세로 쳐서 비교하고, 누골은 재련할 때 바로
        내는 골드예요.
      </p>
      {/* Always there, one line high: appearing above the rows after the load moved them (PM-프론트 #1932 P3). */}
      <p className={styles.notice} role="status">
        {failed
          ? "비교 계산을 불러오지 못했어요. 위 결과는 그대로예요."
          : noPrices
            ? "재료 시세를 불러오지 못해 비교하지 않았어요. 위 결과는 그대로예요."
            : ""}
      </p>
      {/* Rows kept from the last basis or mode while the new prices come are dimmed (A8, as the result above). */}
      <ul
        className={styles.rows}
        aria-busy={prices.isPlaceholderData || undefined}
        data-stale={prices.isPlaceholderData || undefined}
      >
        {requests.map(({ part, request }, i) => {
          const without = plans[i * 2]?.data?.data;
          const withBreath = plans[i * 2 + 1]?.data?.data;
          const c = without && withBreath ? breathCompare(without, withBreath, mode, priceList) : null;
          const left = leftOutLabel(c?.unpriced ?? []);
          return (
            <li key={`${part.id}:${request.fromStage}:${request.toStage}`} className={styles.row}>
              <p className={styles.part}>
                <b>{part.label}</b> +{request.fromStage} → +{request.toStage}
              </p>
              <dl className={styles.sides}>
                <div data-cheaper={c?.cheaper === "without" || undefined}>
                  <dt>
                    숨결 없이
                    {c?.cheaper === "without" && <span className={styles.sr}> · 더 적게 들어요</span>}
                  </dt>
                  <dd>
                    {total(c?.without)}
                    <small>누골 {gold(c?.without.nugol)}</small>
                  </dd>
                </div>
                <div data-cheaper={c?.cheaper === "with" || undefined}>
                  <dt>
                    숨결 최대
                    {c?.cheaper === "with" && <span className={styles.sr}> · 더 적게 들어요</span>}
                  </dt>
                  <dd>
                    {total(c?.with)}
                    <small>
                      누골 {gold(c?.with.nugol)} · 숨결 {c ? `${formatCount(c.with.breaths)}개` : DASH}
                    </small>
                  </dd>
                </div>
              </dl>
              <p className={styles.verdict}>{verdictText(c)}</p>
              {/* Same line every time (empty when all are priced), so a refresh never moves the next row. */}
              {/* Short on screen (two names + '외 N개'), every name read out and on hover (PM-프론트 #1943). */}
              {/* The title sits on the hidden visible span: on the paragraph it became its description, read twice. */}
              <p className={styles.unpriced}>
                <span aria-hidden="true" title={left.full || undefined}>
                  {left.visible}
                </span>
                <span className={styles.sr}>{left.full}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
