"use client";

// (ours, X3 part 2, web #1951) 상급 재련 on the 재련 계산기, behind REFINING_ADVANCED (paired with the api's switch):
// the per-part 상급 stages (current from the equipment tooltips, target by hand or '고른 부위 상급 +10' in the targets
// row), one advanced-plans request per part, and the band rows in the result. The bands' materials and refine gold
// join the page total (refining-plan.tsx, 프론트 OK 11-22); they are expected values in every mode.
import { useId, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Select } from "@/components/ui/select";
import { RefiningQueryError, postAdvancedPlan } from "@/lib/refining/client";
import {
  ADVANCED_MAX,
  ADVANCED_PARTS,
  NO_ADVANCED_JEONYUL,
  advancedFailureCopy,
  advancedRequests,
  advancedTotal,
  advancedView,
  bandValue,
  hasAdvanced,
  initialAdvanced,
  type AdvancedPartId,
  type AdvancedPartPlan,
  type AdvancedStages,
} from "@/lib/refining/advanced";
import { formatCount, type Mode, type PartId, type PartState } from "@/lib/refining/model";
import type { MaterialPrice } from "@/lib/market/model";
import { useUrlState, type UrlCodec } from "@/lib/tools/url-state";
import styles from "./refining-advanced.module.css";

type Parts = Record<PartId, PartState>;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** One default object, so "unchanged" stays out of the address. */
const INITIAL = initialAdvanced();
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const stage = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= ADVANCED_MAX ? v : null);
/** 'adv' in the address: each part's current and target as typed; a wrong part keeps its default. */
const advancedCodec: UrlCodec<AdvancedStages> = {
  parse: (raw) => {
    try {
      const v: unknown = JSON.parse(raw);
      if (!isRecord(v)) return null;
      const out = initialAdvanced();
      for (const part of ADVANCED_PARTS) {
        const p = v[part.id];
        if (!isRecord(p)) continue;
        const current = stage(p.current);
        const target = stage(p.target);
        if (current != null && target != null) out[part.id] = { current, target: Math.max(current, target) };
      }
      return out;
    } catch {
      return null;
    }
  },
  format: (value) => JSON.stringify(value),
};

/** The page's 상급 state and answers (called once, by the page, so the card, the total and the rows share them). */
export function useAdvanced(parts: Parts, enabled: boolean) {
  const [stages, setStages] = useUrlState<AdvancedStages>("adv", INITIAL, advancedCodec);
  const requests = useMemo(() => (enabled ? advancedRequests(stages, parts) : []), [enabled, stages, parts]);
  const queries = useQueries({
    queries: requests.map(({ request, key }) => ({
      queryKey: ["refining-advanced", key],
      queryFn: ({ signal }: { signal: AbortSignal }) => postAdvancedPlan(request, signal),
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });
  const plans: AdvancedPartPlan[] = queries.flatMap((q, i) => (q.data ? [advancedView(requests[i].part, q.data.data)] : []));
  const failed = queries.find((q) => q.isError);
  const failure =
    failed?.error instanceof RefiningQueryError ? failed.error.info : failed ? { code: "LOST_ARK_API_ERROR", status: 502 } : null;
  const complete = plans.length === requests.length;
  return {
    enabled,
    stages,
    setStages,
    requests,
    plans,
    /** What joins the page total; null until every part answered (the total waits as it does for 일반). */
    total: requests.length > 0 && complete ? advancedTotal(plans) : null,
    names: [...new Set(plans.flatMap((plan) => plan.bands.flatMap((band) => band.materials.map((item) => item.name))))],
    pending: queries.some((q) => q.isPending),
    complete,
    failed,
    failure,
    /** After a character load: each part's current from its tooltip, the target kept only when it is still above. */
    load(levels: Record<AdvancedPartId, number | null>, keepTargets: boolean) {
      setStages((prev) =>
        Object.fromEntries(
          ADVANCED_PARTS.map((part) => {
            const current = levels[part.id] ?? 0;
            const kept = keepTargets ? prev[part.id].target : 0;
            return [part.id, { current, target: Math.max(current, kept) }];
          }),
        ) as AdvancedStages,
      );
    },
  };
}
export type Advanced = ReturnType<typeof useAdvanced>;

/** The 상급 재련 rows in the 목표 단계 card: each part's current and target stage (0~40). */
export function RefiningAdvanced({ advanced, parts }: { advanced: Advanced; parts: Parts }) {
  const headingId = useId();
  const { stages, setStages } = advanced;
  const set = (id: AdvancedPartId, next: { current: number; target: number }) =>
    setStages((prev) => ({ ...prev, [id]: next }));
  const jeonyul = ADVANCED_PARTS.filter((part) => parts[part.id].enabled && parts[part.id].grade === "JEONYUL");
  return (
    <section className={styles.advanced} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.title}>
        상급 재련
      </h3>
      <ul className={styles.rows}>
        {ADVANCED_PARTS.map((part) => {
          const open = hasAdvanced(parts[part.id]);
          const { current, target } = stages[part.id];
          const up = open ? target - current : 0;
          return (
            <li key={part.id} className={styles.row} data-off={!open || undefined}>
              <strong className={styles.part}>{part.label}</strong>
              <span className={styles.up}>{!open ? "없음" : up > 0 ? `+${up}` : "유지"}</span>
              <label className={styles.mini}>
                <span>현재</span>
                <Select
                  value={current}
                  disabled={!open}
                  aria-label={`${part.label} 상급 재련 현재 단계`}
                  onValueChange={(value) => set(part.id, { current: value, target: Math.max(value, target) })}
                  items={range(0, ADVANCED_MAX - 1).map((n) => ({ value: n, label: String(n) }))}
                />
              </label>
              <label className={styles.mini}>
                <span>목표</span>
                <Select
                  value={target}
                  disabled={!open}
                  aria-label={`${part.label} 상급 재련 목표 단계`}
                  onValueChange={(value) => set(part.id, { current, target: value })}
                  items={range(current, ADVANCED_MAX).map((n) => ({ value: n, label: String(n) }))}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <p className={styles.caption}>
        10단계 구간마다 기대값으로 계산해요. 숨결·책은 지금 최저가로 기대 비용이 가장 작은 조합을 써요.
        {/* Always the same sentence when a 전율 part is in the plan: nothing moves when it comes (A7). */}
        {jeonyul.length > 0 && ` ${NO_ADVANCED_JEONYUL}`}
      </p>
    </section>
  );
}

/**
 * The line under the total while a 상급 target is set: there from the first frame (A7), its words only in the 50% ·
 * 90% · 장인의 기운 modes, where the 일반 part follows the mode and 상급 stays its expected value.
 */
export function AdvancedModeLine({ advanced, mode }: { advanced: Advanced; mode: Mode }) {
  if (advanced.requests.length === 0) return null;
  return (
    <p className={styles.modeLine}>
      {mode === "expected" ? "" : "상급 재련은 구간별 기대값이에요(50% · 90% · 장인의 기운 값이 없어요)."}
    </p>
  );
}

/** The band rows: each part's 10-stage bands, valued at the page's prices. */
export function AdvancedBands({ advanced, prices }: { advanced: Advanced; prices: MaterialPrice[] | null }) {
  const { plans } = advanced;
  if (plans.length === 0) return null;
  const tempering = [...new Set(plans.flatMap((plan) => plan.temperingStages))].sort((a, b) => a - b);
  const single = plans.some((plan) => plan.bands.some((band) => band.singleSource));
  const limited = plans.some((plan) => plan.policyLimited);
  return (
    <details className={styles.bands} open>
      <summary className="hit-44">상급 재련 구간별</summary>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">구간</th>
              <th scope="col">기대 시도</th>
              <th scope="col">숨결·책</th>
              <th scope="col">재련 골드</th>
              <th scope="col">재료까지 시세로</th>
            </tr>
          </thead>
          <tbody>
            {plans.flatMap(({ part, bands }) =>
              bands.map((band) => {
                const value = bandValue(band, prices);
                return (
                  <tr key={`${part.id}-${band.from}`}>
                    <th scope="row">{`${part.label} ${band.from}→${band.to}`}</th>
                    <td>{formatCount(band.turns, 2)}</td>
                    <td>{band.policy || "—"}</td>
                    <td>
                      {formatCount(Math.ceil(band.refineGold - 1e-9))}
                      {band.growthSupport && <small>성장 지원</small>}
                    </td>
                    <td>
                      {value == null ? "—" : formatCount(value.value)}
                      {value?.unpriced && <small>시세 없는 재료 뺌</small>}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.caption}>
        기대 시도는 유료 · 무료 · 선조 턴을 더한 값이에요.
        {tempering.length > 0 && ` ${tempering.join(" · ")}단계 담금질 재료는 귀속이라 금액에 넣지 않았어요.`}
        {limited && " 시세가 없는 숨결·책은 쓰지 않는 조합 중에서 골랐어요."}
        {single && " 아직 한 곳에서만 확인한 값이 들어 있어요."}
      </p>
    </details>
  );
}

/** The failure of a 상급 request, in its own words (전율 '계산하지 않음', price pending). */
export const advancedFailure = (advanced: Advanced) =>
  advanced.failure ? advancedFailureCopy(advanced.failure) : null;
